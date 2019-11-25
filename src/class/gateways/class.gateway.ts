import { MessageBody, OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer, WsResponse, OnGatewayDisconnect, ConnectedSocket } from '@nestjs/websockets';
import * as mediasoup from 'mediasoup';
import { Producer, Router, Worker, Transport, Consumer, WebRtcTransport } from 'mediasoup/lib/types';
import { Server, Socket, Client } from 'socket.io';
import { config } from '../../config';
import { ClassDetails } from '../../entities/class.entity';
import { ClassService } from '../class.service';
import { Logger } from '@nestjs/common';

interface RoomStudent {
    isProducer: boolean;
    producer?: Producer;
    consumerTransport?: WebRtcTransport;
    consumer?: Consumer;
    teacherConsumer?: Consumer;
    producerTransport?: WebRtcTransport;
    consumers?: Map<string, Consumer>;
    socket?: Socket;
}

interface Room {
    teacher: {
        producer?: Producer;
        producerTransport?: WebRtcTransport;
        consumerTransport?: WebRtcTransport;
        state?: string;
        socket?: Socket;
        id: string;
    };
    students: Map<string, RoomStudent>;
    classDetails: ClassDetails;
    id: string;
    worker?: Worker;
    studentIds: string[]
}


@WebSocketGateway()
export class ClassGateway implements OnGatewayDisconnect {

    @WebSocketServer()
    server: Server;
    worker: Worker;
    mediasoupRouter: Router;
    rooms = new Map<string, Room>();
    roomIds: string[] = [];

    constructor(private classService: ClassService) { }

    /**
     * Other Part Start
     */

    @SubscribeMessage('get-active-classes')
    async findAllClasses(@MessageBody() data: any): Promise<WsResponse<ClassDetails[]>> {
        const classes = await this.classService.getLiveClasses();
        return Promise.resolve({
            event: 'live-classes',
            data: classes,
        });
    }

    /**
     * Other Part End
     * Common Part Start
     */

    async  runMediasoupWorker() {
        this.worker = await mediasoup.createWorker({
            rtcMinPort: config.mediasoup.worker.rtcMinPort,
            rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
        });
        this.worker.on('died', () => {
            console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', this.worker.pid);
            setTimeout(() => process.exit(1), 2000);
        });
        const mediaCodecs = config.mediasoup.router.mediaCodecs;
        this.mediasoupRouter = await this.worker.createRouter({ mediaCodecs });
    }

    @SubscribeMessage('get-capabilities')
    async getCapabilities(@MessageBody() data) {
        if (!this.mediasoupRouter) {
            await this.runMediasoupWorker();
        }
        return ({
            event: 'receive-capabilities',
            data: this.mediasoupRouter.rtpCapabilities
        });
    }

    async createTransport() {
        const {
            maxIncomingBitrate,
            initialAvailableOutgoingBitrate
        } = config.mediasoup.webRtcTransport;

        const transport = await this.mediasoupRouter.createWebRtcTransport({
            listenIps: config.mediasoup.webRtcTransport.listenIps,
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            initialAvailableOutgoingBitrate,
        });

        if (maxIncomingBitrate) {
            await transport.setMaxIncomingBitrate(maxIncomingBitrate);
        }
        return transport;
    }

    async createConsumerForTransport(producer, transport, rtpCapabilities: any) {
        return await transport.consume({
            producerId: producer.id,
            rtpCapabilities,
            paused: true,
        });
    }

    handleDisconnect(socket: Socket) {
        this.roomIds.forEach(roomId => {
            const room = this.rooms.get(roomId);
            if (room.teacher.socket && room.teacher.socket.id === socket.id) {
                Logger.log(`Current teacher session disconnected :${roomId}`);
                room.teacher.state = 'paused';
                room.teacher.socket = null;
                if (room.teacher.producerTransport) room.teacher.producerTransport.close();

                room.teacher.producerTransport === null;
                return;
            }

            room.studentIds.forEach(id => {
                const student = room.students.get(id);
                if (student.socket && student.socket.id === socket.id) {
                    Logger.log(`Current student session disconnected from room:${roomId}, student: ${id}`);
                    student.socket = null;
                    if (student.producerTransport) student.producerTransport.close();
                    if (student.consumerTransport) student.consumerTransport.close();
                    student.consumerTransport = null;
                    if (room.teacher && room.teacher.socket) this.server.to(room.teacher.socket.id).emit('student-disconnected', { studentId: id });
                    return;
                }
            });
        });
    }

    /**
     * Common part End
     * 
     * Teacher part start
     * 
     * Teacher produce start
     */


    @SubscribeMessage('start-class')
    async startClass(@MessageBody() data, @ConnectedSocket() socket: Socket) {
        const { classId, rtpCapabilities } = data;
        const classDetails = await this.classService.getClassDetails(classId);
        const teacher = classDetails.teacher;
        if (!this.rooms.has(classDetails.id)) {
            let roomData = {
                id: classId,
                students: new Map<string, RoomStudent>(),
                classDetails,
                teacher: {
                    id: teacher.id,
                    state: 'started'
                },
                studentIds: []
            };
            this.rooms.set(classId, roomData);
            this.roomIds.push(classId);
            Logger.log(`Room Created: ${classId}`);
        }

        const room = this.rooms.get(classId);
        Logger.log(`Room teacher video connecting fresh`);
        room.teacher.state = 'started';
        room.teacher.socket = socket;
        room.teacher.producerTransport = await this.createTransport();
        return Promise.resolve({
            event: 'class-started',
            data: {
                id: room.teacher.producerTransport.id,
                iceParameters: room.teacher.producerTransport.iceParameters,
                iceCandidates: room.teacher.producerTransport.iceCandidates,
                dtlsParameters: room.teacher.producerTransport.dtlsParameters
            }
        });
    }

    @SubscribeMessage('connect-producer-transport-teacher')
    async connectProducerTransport(@MessageBody() data) {
        const { dtlsParameters, classId } = data;
        const room = this.rooms.get(classId);
        await room.teacher.producerTransport.connect({ dtlsParameters });
        return Promise.resolve({
            event: 'teacher-producer-transport-connected'
        });
    }

    @SubscribeMessage('teacher-produce')
    async produce(@MessageBody() data) {
        const { classId, kind, rtpParameters } = data;
        const room = this.rooms.get(classId);
        room.teacher.producer = await room.teacher.producerTransport.produce({ kind, rtpParameters });
        Logger.log(`Teacher producer Id: ${room.teacher.producer.id}`);
        return Promise.resolve({
            event: 'teacher-produced',
            data: { id: room.teacher.producer.id }
        });
    }

    @SubscribeMessage('create-teacher-consumer-transport')
    async createTeacherConsumerTransport(@MessageBody() data) {
        const { classId } = data;
        const room = this.rooms.get(classId);
        room.teacher.consumerTransport = await this.createTransport();
        return Promise.resolve({
            event: 'teacher-consumer-transport-created',
            data: {
                id: room.teacher.consumerTransport.id,
                iceParameters: room.teacher.consumerTransport.iceParameters,
                iceCandidates: room.teacher.consumerTransport.iceCandidates,
                dtlsParameters: room.teacher.consumerTransport.dtlsParameters
            }
        });
    }

    @SubscribeMessage('connect-consumer-transport-teacher')
    async connectStudentTeacherConsumerTransport(@MessageBody() data) {
        const { dtlsParameters, classId, userId } = data;
        const room = this.rooms.get(classId);
        await room.teacher.consumerTransport.connect({ dtlsParameters });
        return Promise.resolve({
            event: 'teacher-consumer-transport-connected'
        });
    }

    @SubscribeMessage('consume-student-video')
    async consumeStudentVideo(@MessageBody() data) {
        const { rtpCapabilities, classId, userId, otherStudentId } = data;
        const room = this.rooms.get(classId);
        const remoteStudent = room.students.get(otherStudentId);
        try {
            remoteStudent.teacherConsumer = await this.createConsumerForTransport(remoteStudent.producer, room.teacher.consumerTransport, rtpCapabilities);
        } catch (e) {
            Logger.log(`Error` + e);
        }
        return Promise.resolve({
            event: 'consumed-student',
            data:
            {
                producerId: remoteStudent.producer.id,
                id: remoteStudent.teacherConsumer.id,
                kind: remoteStudent.teacherConsumer.kind,
                rtpParameters: remoteStudent.teacherConsumer.rtpParameters,
                type: remoteStudent.teacherConsumer.type,
                producerPaused: remoteStudent.teacherConsumer.producerPaused,
                otherStudentId
            }
        });
    }

    @SubscribeMessage('resume-student-video-for-teacher')
    async resumeStudentvideoForTeacher(@MessageBody() data) {
        const { classId, studentId } = data;

        const room = this.rooms.get(classId);
        const remoteStudent = room.students.get(studentId);
        await remoteStudent.teacherConsumer.resume();

        return Promise.resolve({
            event: 'student-video-resumed-for-teacher'
        });
    }

    /**
     * Teacher Produce End
     */

    /**
     * Teacher End
     * 
     * Student Start
     */

    @SubscribeMessage('get-class-details')
    async getClassDetails(@MessageBody() data) {
        const { classId } = data;
        const classDetails = await this.classService.getClassDetails(classId);
        const state = this.rooms.has(classId) ? this.rooms.get(classId).teacher.state : 'not-started';
        return {
            event: 'take-class-details',
            data: {
                classDetails,
                state
            }
        };
    }

    @SubscribeMessage('create-consumer-transport-student')
    async createConsumerTransportForStudent(@MessageBody() data, @ConnectedSocket() socket: Socket) {
        const { classId, userId } = data;
        const room = this.rooms.get(classId);
        if (!room.students.has(userId)) {
            const roomStudentInfo = {
                isProducer: false,
                consumers: new Map<string, Consumer>()
            }

            room.studentIds.push(userId);
            room.students.set(userId, roomStudentInfo);
        }

        const student = room.students.get(userId);
        const transport = await this.createTransport();
        student.consumerTransport = transport;
        student.socket = socket;
        return Promise.resolve({
            event: 'student-consumer-transport-created',
            data: {
                id: student.consumerTransport.id,
                iceParameters: student.consumerTransport.iceParameters,
                iceCandidates: student.consumerTransport.iceCandidates,
                dtlsParameters: student.consumerTransport.dtlsParameters
            }
        });
    }

    @SubscribeMessage('connect-consumer-transport-student')
    async connectConsumerTransportStudent(@MessageBody() data) {
        const { dtlsParameters, classId, userId } = data;
        const room = this.rooms.get(classId);
        const student = room.students.get(userId);
        Logger.log(`Connecting student`);
        await student.consumerTransport.connect({ dtlsParameters });
        return Promise.resolve({
            event: 'student-consumer-transport-connected'
        });
    }

    @SubscribeMessage('consume-teacher-video')
    async consumeTeacherVideo(@MessageBody() data) {
        const { rtpCapabilities, classId, userId } = data;
        const room = this.rooms.get(classId);
        const student = room.students.get(userId);
        student.consumer = await this.createConsumerForTransport(room.teacher.producer, student.consumerTransport, rtpCapabilities);
        return Promise.resolve({
            event: 'consumed-teacher',
            data:
            {
                producerId: room.teacher.producer.id,
                id: student.consumer.id,
                kind: student.consumer.kind,
                rtpParameters: student.consumer.rtpParameters,
                type: student.consumer.type,
                producerPaused: student.consumer.producerPaused
            }
        });
    }

    @SubscribeMessage('resume-teacher')
    async resumeTeacher(@MessageBody() data) {
        const { classId, userId } = data;
        const room = this.rooms.get(classId);
        const student = room.students.get(userId);
        await student.consumer.resume();

        return Promise.resolve({
            event: 'teacher-resumed'
        });
    }

    @SubscribeMessage('start-student-video')
    async startStudentVideo(@MessageBody() data) {
        const { classId, rtpCapabilities, userId } = data;
        const room = this.rooms.get(classId);
        const student = room.students.get(userId);
        student.producerTransport = await this.createTransport();

        return Promise.resolve({
            event: 'started-student-video',
            data: {
                id: student.producerTransport.id,
                iceParameters: student.producerTransport.iceParameters,
                iceCandidates: student.producerTransport.iceCandidates,
                dtlsParameters: student.producerTransport.dtlsParameters
            }
        });
    }

    @SubscribeMessage('connect-producer-transport-student')
    async connectStudentProducerTransport(@MessageBody() data) {
        const { dtlsParameters, classId, userId } = data;
        const room = this.rooms.get(classId);
        const student = room.students.get(userId);
        await student.producerTransport.connect({ dtlsParameters });
        return Promise.resolve({
            event: 'student-producer-transport-connected'
        });
    }

    @SubscribeMessage('student-produce')
    async produceStudent(@MessageBody() data) {
        const { classId, kind, rtpParameters, userId } = data;
        const room = this.rooms.get(classId);
        const student = room.students.get(userId);
        student.producer = await student.producerTransport.produce({ kind, rtpParameters });
        Logger.log(`Student producer Id: ${student.producer.id}`);
        this.server.to(room.teacher.socket.id).emit('new-student-joined', { studentId: userId });
        room.studentIds.forEach(id => {
            const student = room.students.get(id);
            if (student.socket && id !== userId) {
                this.server.to(student.socket.id).emit('new-other-student', { studentId: userId });
            }
        });
        return Promise.resolve({
            event: 'student-produced',
            data: { id: student.producer.id }
        });
    }

    @SubscribeMessage('consume-other-student-video')
    async consumeOtherStudentVideo(@MessageBody() data) {
        const { classId, userId, otherStudentId, rtpCapabilities } = data;
        const room = this.rooms.get(classId);
        const student = room.students.get(userId);
        const remoteStudent = room.students.get(otherStudentId);
        Logger.log('transport' + remoteStudent.producer.id);
        let consumer;
        try {
            consumer = await this.createConsumerForTransport(remoteStudent.producer, student.consumerTransport, rtpCapabilities);
            Logger.log(consumer);
        } catch (err) {
            Logger.log(`err :::` + err);
        }
        remoteStudent.consumers.set(userId, consumer);
        Logger.log(data);
        return Promise.resolve({
            event: 'other-student-video-consumed',
            data:
            {
                producerId: remoteStudent.producer.id,
                id: consumer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                type: consumer.type,
                producerPaused: consumer.producerPaused
            }
        });
    }

    @SubscribeMessage('resume-other-student-video')
    async resumeOtherStudentVideo(@MessageBody() data) {
        const { classId, userId, otherStudentId } = data;
        const room = this.rooms.get(classId);
        const remoteStudent = room.students.get(otherStudentId);
        const consumer = remoteStudent.consumers.get(userId);
        await consumer.resume();
        return Promise.resolve({
            event: 'other-student-video-resumed'
        });
    }
    /**
     * Student part end
     */

    @SubscribeMessage('create-consumer-transport')
    async createConsumerTransport(@MessageBody() data, @ConnectedSocket() socket: Socket) {
        const {
            maxIncomingBitrate,
            initialAvailableOutgoingBitrate
        } = config.mediasoup.webRtcTransport;

        const { classId, userId } = data;

        const room = this.rooms.get(classId);
        let roomStudent: RoomStudent;
        const transport = await this.mediasoupRouter.createWebRtcTransport({
            listenIps: config.mediasoup.webRtcTransport.listenIps,
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            initialAvailableOutgoingBitrate,
        });
        if (room.teacher.id !== userId) {
            roomStudent = {
                isProducer: false,
                consumerTransport: transport,
                socket: socket
            };

            room.students.set(userId, roomStudent);
            // }

            if (maxIncomingBitrate) {
                try {
                    await transport.setMaxIncomingBitrate(maxIncomingBitrate);
                } catch (error) {
                }
            }

            return Promise.resolve({
                event: 'consumer-transport-created',
                data: {
                    id: transport.id,
                    iceParameters: transport.iceParameters,
                    iceCandidates: transport.iceCandidates,
                    dtlsParameters: transport.dtlsParameters
                }
            });
        }

        if (room.teacher.id === userId) {
            if (!room.teacher.consumerTransport) {
                room.teacher.consumerTransport = transport;
                if (maxIncomingBitrate) {
                    try {
                        await transport.setMaxIncomingBitrate(maxIncomingBitrate);
                    } catch (error) {
                    }
                }

            }
            return Promise.resolve({
                event: 'consumer-transport-created',
                data: {
                    id: transport.id,
                    iceParameters: transport.iceParameters,
                    iceCandidates: transport.iceCandidates,
                    dtlsParameters: transport.dtlsParameters
                }
            });
        }
    }


    @SubscribeMessage('connect-consumer-transport')
    async connectConsumerTransport(client: Socket, @MessageBody() data) {
        const { dtlsParameters, classId, userId } = data;
        const room = this.rooms.get(classId);
        if (userId !== room.teacher.id) {
            const roomStudent = room.students.get(userId);
            await roomStudent.consumerTransport.connect({ dtlsParameters });
            return Promise.resolve({
                event: 'consumer-transport-connected'
            });
        }

        if (userId === room.teacher.id) {
            await room.teacher.consumerTransport.connect({ dtlsParameters });
            return Promise.resolve({
                event: 'consumer-transport-connected'
            });
        }
    }

    @SubscribeMessage('consume')
    async consume(@MessageBody() data) {
        const { rtpCapabilities, classId, userId, remoteUserId } = data;
        const room = this.rooms.get(classId);
        if (room.teacher.id !== userId) {
            const roomStudent = room.students.get(userId);
            const dataConsumer = await this.createConsumer(room.teacher.producer, roomStudent, rtpCapabilities);
            return Promise.resolve({
                event: 'consumed',
                data: dataConsumer
            });
        }

        if (room.teacher.id === userId) {
            const remoteRoomStudent = room.students.get(remoteUserId);
            remoteRoomStudent.teacherConsumer = await room.teacher.consumerTransport.consume({
                producerId: remoteRoomStudent.producer.id,
                rtpCapabilities,
                paused: true
            });
            return Promise.resolve({
                event: 'consumed',
                data: {
                    producerId: remoteRoomStudent.producer.id,
                    id: remoteRoomStudent.teacherConsumer.id,
                    kind: remoteRoomStudent.teacherConsumer.kind,
                    rtpParameters: remoteRoomStudent.teacherConsumer.rtpParameters,
                    type: remoteRoomStudent.teacherConsumer.type,
                    producerPaused: remoteRoomStudent.teacherConsumer.producerPaused,
                    studentId: remoteUserId
                }
            });
        }
    }

    @SubscribeMessage('consume-other-student')
    async consumeOtherStudent(@MessageBody() data: any) {

        const { rtpCapabilities, classId, userId, remoteUserId } = data;
        const room = this.rooms.get(classId);
        const remoteRoom = room.students.get(remoteUserId);
        const userRoom = room.students.get(userId);
        Logger.log('Consumer:');
        let consumer;
        try {
            consumer = await userRoom.consumerTransport.consume({
                producerId: remoteRoom.producer.id,
                rtpCapabilities,
                paused: true
            });
        } catch (e) {
            Logger.log(e);
        }

        userRoom.consumers.set(remoteUserId, consumer);
        return Promise.resolve({
            event: 'other-student-consumed',
            data: {
                producerId: remoteRoom.producer.id,
                id: consumer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                type: consumer.type,
                producerPaused: consumer.producerPaused,
                studentId: remoteUserId
            }
        });
    }

    async createConsumer(producer, roomStudent: RoomStudent, rtpCapabilities: any) {

        roomStudent.consumer = await roomStudent.consumerTransport.consume({
            producerId: producer.id,
            rtpCapabilities,
            paused: true,
        });

        return {
            producerId: producer.id,
            id: roomStudent.consumer.id,
            kind: roomStudent.consumer.kind,
            rtpParameters: roomStudent.consumer.rtpParameters,
            type: roomStudent.consumer.type,
            producerPaused: roomStudent.consumer.producerPaused
        };
    }

    @SubscribeMessage('resume')
    async resume(@MessageBody() data) {
        const { classId, userId, remoteUserId } = data;
        const room = this.rooms.get(classId);
        if (room.teacher.id !== userId) {
            const roomStudent = room.students.get(userId);
            await roomStudent.consumer.resume();

            return Promise.resolve({
                event: 'resumed'
            });
        }

        if (room.teacher.id === userId) {
            const remoteRoomStudent = room.students.get(remoteUserId);
            await remoteRoomStudent.teacherConsumer.resume();
            return Promise.resolve({
                event: 'resumed'
            });
        }
    }

    @SubscribeMessage('resume-other-student')
    async resumeOtherStudent(@MessageBody() data) {
        const { classId, userId, remoteUserId } = data;
        const room = this.rooms.get(classId);
        const userRoom = room.students.get(userId);
        const remoteConsumer = userRoom.consumers.get(remoteUserId);
        if (remoteConsumer) {
            await remoteConsumer.resume();
        }
        return Promise.resolve({
            event: 'other-student-consumed'
        });
    }



    // @SubscribeMessage('start-student-video')
    // async startStudentVideo(@MessageBody() data) {
    //     const { userId, classId, rtpCapabilities } = data;
    //     const room = this.rooms.get(classId);
    //     const roomStudent = room.students.get(userId);
    //     const {
    //         maxIncomingBitrate,
    //         initialAvailableOutgoingBitrate
    //     } = config.mediasoup.webRtcTransport;
    //     roomStudent.producerTransport = await this.mediasoupRouter.createWebRtcTransport({
    //         listenIps: config.mediasoup.webRtcTransport.listenIps,
    //         enableUdp: true,
    //         enableTcp: true,
    //         preferUdp: true,
    //         initialAvailableOutgoingBitrate,
    //     });

    //     if (maxIncomingBitrate) {
    //         try {
    //             await room.teacher.producerTransport.setMaxIncomingBitrate(maxIncomingBitrate);
    //         } catch (error) {
    //         }
    //     }

    //     return Promise.resolve({
    //         event: 'student-producer-transport-started',
    //         data: {
    //             id: roomStudent.producerTransport.id,
    //             iceParameters: roomStudent.producerTransport.iceParameters,
    //             iceCandidates: roomStudent.producerTransport.iceCandidates,
    //             dtlsParameters: roomStudent.producerTransport.dtlsParameters
    //         }
    //     });
    // }

    handleConnection(client: Socket, ...args: any[]) {
        // console.log(client);
    }

    // handleDisconnect(socket: Socket) {
    //     let room: Room;
    //     for (const [roomId, roomDetails] of this.rooms) {
    //         room = this.rooms.get(roomId);
    //         if (room.teacher && room.teacher.socket && room.teacher.socket.id === socket.id) {
    //             if (room.teacher.producerTransport) room.teacher.producerTransport.close();
    //             if (room.teacher.consumerTransport) room.teacher.consumerTransport.close();

    //             room.teacher.state = 'disconnected';
    //             room.students.forEach(student => {
    //                 this.server.to(student.socket.id).emit('teacher-video-paused');
    //             });

    //             break;
    //         }
    //         let student;
    //         if (room.teacher.socket.id !== socket.id) {
    //             for (const [studentId, roomStudent] of room.students) {
    //                 if (roomStudent.socket.id === socket.id) {
    //                     this.server.to(room.teacher.socket.id).emit('student-disconnected', { studentId });
    //                     if (roomStudent.consumerTransport) roomStudent.consumerTransport.close();
    //                     if (roomStudent.producerTransport) roomStudent.producerTransport.close();
    //                 }
    //                 room.students.delete(studentId);
    //                 console.log(room.students.keys());
    //                 break;
    //             }
    //         }
    //     }
    // }
}

