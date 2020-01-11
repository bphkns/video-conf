import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer, WsResponse } from '@nestjs/websockets';
import * as mediasoup from 'mediasoup';
import { Consumer, Producer, Router, WebRtcTransport, Worker } from 'mediasoup/lib/types';
import { Server, Socket } from 'socket.io';
import { config } from '../../config';
import { ClassDetails } from '../../entities/class.entity';
import { ClassService } from '../class.service';

interface RoomStudent {
    teacherAudioConsumer?: Consumer;
    isProducer: boolean;
    producer?: Producer;
    audioProducer?: Producer;
    consumerTransport?: WebRtcTransport;
    consumer?: Consumer;
    audioConsumer?: Consumer;
    teacherConsumer?: Consumer;
    producerTransport?: WebRtcTransport;
    consumers?: Map<string, { consumer: Consumer, audioConsumer: Consumer }>;
    socket?: Socket;
}

interface Room {
    teacher: {
        producer?: Producer;
        audioProducer?: Producer;
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
    drawingData = new Map<string, {
        config: {
            lineSize: string,
            pencilColor: string,
            canvasBackgroundColor: string,
            mode: string
        },
        data: any[]
    }>();
    studentsOnClassPage = new Map<string, string[]>();
    studentsOnClassIds = [];


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

        this.studentsOnClassIds.forEach(classId => {
            if (this.studentsOnClassPage.has(classId)) {
                let students = this.studentsOnClassPage.get(classId);
                students = students.filter(id => id !== socket.id);
                if (students.length > 0) {
                    this.studentsOnClassPage.set(classId, students);
                }

                if (students.length === 0) {
                    this.studentsOnClassIds = this.studentsOnClassIds.filter(id => id !== classId);
                    this.studentsOnClassPage.delete(classId);
                }
            }

            console.log(this.studentsOnClassPage.get(classId));
        })

        this.roomIds.forEach(roomId => {
            const room = this.rooms.get(roomId);
            if (room.teacher.socket && room.teacher.socket.id === socket.id) {
                Logger.log(`Current teacher session disconnected :${roomId}`);
                room.teacher.socket = null;
                room.teacher.state = 'paused';
                if (room.teacher.producerTransport) room.teacher.producerTransport.close();
                room.teacher.producerTransport === null;
                room.studentIds.forEach(id => {
                    const student = room.students.get(id);
                    if (student.socket) {
                        this.server.to(student.socket.id).emit('teacher-temporary-disconnected');
                    }
                });
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

                    const studentsList = room.studentIds.filter(sId => {
                        const student = room.students.get(sId);
                        return student.socket && id !== sId;
                    });

                    studentsList.forEach(sId => {
                        const student = room.students.get(sId);
                        this.server.to(student.socket.id).emit('other-student-disconnected', { studentId: id });
                    });

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
        if (kind === 'video') {
            room.teacher.producer = await room.teacher.producerTransport.produce({ kind, rtpParameters });
            Logger.log(`Teacher video producer Id: ${room.teacher.producer.id}`);
            return Promise.resolve({
                event: 'teacher-produced',
                data: { id: room.teacher.producer.id }
            });
        }
        if (kind === 'audio') {
            room.teacher.audioProducer = await room.teacher.producerTransport.produce({ kind, rtpParameters });
            Logger.log(`Teacher audio producer Id: ${room.teacher.audioProducer.id}`);
            return Promise.resolve({
                event: 'teacher-produced',
                data: { id: room.teacher.audioProducer.id }
            });
        }
    }

    @SubscribeMessage('teacher-connect-with-exisisting-students')
    async connectWithOldStudents(@MessageBody() data) {
        const { classId } = data;
        const room = this.rooms.get(classId);
        const waitingRoom = this.studentsOnClassPage.has(classId) ? this.studentsOnClassPage.get(classId) : [];

        waitingRoom.forEach(id => {
            this.server.to(id).emit('teacher-started-class');
        });

        room.studentIds.forEach(id => {
            const student = room.students.get(id);
            if (student.socket) {
                this.server.to(room.teacher.socket.id).emit('new-student-joined', { studentId: id });
                this.server.to(student.socket.id).emit('teacher-connect-again');
            }
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
            remoteStudent.teacherAudioConsumer = await this.createConsumerForTransport(remoteStudent.audioProducer, room.teacher.consumerTransport, rtpCapabilities);
        } catch (e) { console.log(e) }
        return ({
            event: 'consumed-student',
            data:
            {
                producerId: remoteStudent.producer.id,
                id: remoteStudent.teacherConsumer.id,
                kind: remoteStudent.teacherConsumer.kind,
                rtpParameters: remoteStudent.teacherConsumer.rtpParameters,
                type: remoteStudent.teacherConsumer.type,
                producerPaused: remoteStudent.teacherConsumer.producerPaused,
                otherStudentId,
                audioProducerId: remoteStudent.audioProducer.id,
                audioId: remoteStudent.teacherAudioConsumer.id,
                audioKind: remoteStudent.teacherAudioConsumer.kind,
                auidoRtpParameters: remoteStudent.teacherAudioConsumer.rtpParameters,
                audioType: remoteStudent.teacherAudioConsumer.type,
                audioProducerPaused: remoteStudent.teacherAudioConsumer.producerPaused,
            }
        });
    }

    @SubscribeMessage('resume-student-video-for-teacher')
    async resumeStudentvideoForTeacher(@MessageBody() data) {
        const { classId, studentId } = data;

        const room = this.rooms.get(classId);
        const remoteStudent = room.students.get(studentId);
        await remoteStudent.teacherConsumer.resume();
        await remoteStudent.teacherAudioConsumer.resume();
        return Promise.resolve({
            event: 'student-video-resumed-for-teacher'
        });
    }

    @SubscribeMessage('end-class')
    async endClass(@MessageBody() data) {
        const { classId } = data;
        console.log(classId);
        console.log(await this.classService.endClass(classId));
        const room = this.rooms.get(classId);
        this.roomIds = this.roomIds.filter(id => id !== classId);
        room.studentIds.forEach(sId => {
            const student = room.students.get(sId);
            student.producer.close();
            student.consumer.close();
            student.teacherConsumer.close();
            student.audioProducer.close();
            student.teacherAudioConsumer.close();
            student.audioConsumer.close();
            student.consumers.clear();

            if (student.socket) {
                this.server.to(student.socket.id).emit('class-ended');
            }
        });

        room.teacher.producer.close();
        room.teacher.audioProducer.close();
        this.rooms.delete(classId);
        return Promise.resolve({
            event: 'class-ended'
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

    @SubscribeMessage('listenting-teacher')
    async addWaitingStudentsOnpage(@MessageBody() data, @ConnectedSocket() socket: Socket) {
        const { classId } = data;
        console.log(this.studentsOnClassPage.has(classId));
        let classDetails = [];
        if (!this.studentsOnClassPage.has(classId)) {
            this.studentsOnClassPage.set(classId, classDetails);
            this.studentsOnClassIds.push(classId);
        }

        classDetails = this.studentsOnClassPage.get(classId);
        classDetails.push(socket.id);
        console.log(this.studentsOnClassPage.get(classId));
    }

    @SubscribeMessage('get-class-details')
    async getClassDetails(@MessageBody() data) {
        const { classId } = data;
        const classDetails = await this.classService.getClassDetails(classId);
        let state = this.rooms.has(classId) ? this.rooms.get(classId).teacher.state : 'not-started';
        if (classDetails.endedAt) {
            state = 'ended';
        }
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
                consumers: new Map<string, { consumer: Consumer, audioConsumer: Consumer }>()
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
        student.audioConsumer = await this.createConsumerForTransport(room.teacher.audioProducer, student.consumerTransport, rtpCapabilities);
        return Promise.resolve({
            event: 'consumed-teacher',
            data:
            {
                producerId: room.teacher.producer.id,
                id: student.consumer.id,
                kind: student.consumer.kind,
                rtpParameters: student.consumer.rtpParameters,
                type: student.consumer.type,
                producerPaused: student.consumer.producerPaused,
                audioProducerId: room.teacher.audioProducer.id,
                audioId: student.audioConsumer.id,
                audioKind: student.audioConsumer.kind,
                auidoRtpParameters: student.audioConsumer.rtpParameters,
                audioType: student.audioConsumer.type,
                audioProducerPaused: student.audioConsumer.producerPaused,
            }
        });
    }

    @SubscribeMessage('resume-teacher')
    async resumeTeacher(@MessageBody() data) {
        const { classId, userId } = data;
        const room = this.rooms.get(classId);
        const student = room.students.get(userId);
        await student.consumer.resume();
        await student.audioConsumer.resume();
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
        if (kind === 'video') {
            student.producer = await student.producerTransport.produce({ kind, rtpParameters });
            return Promise.resolve({
                event: 'student-produced',
                data: { id: student.producer.id }
            });
        }

        if (kind === 'audio') {
            student.audioProducer = await student.producerTransport.produce({ kind, rtpParameters });
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
                data: { id: student.audioProducer.id }
            });
        }
    }

    @SubscribeMessage('consume-other-student-video')
    async consumeOtherStudentVideo(@MessageBody() data) {
        const { classId, userId, otherStudentId, rtpCapabilities } = data;
        const room = this.rooms.get(classId);
        const student = room.students.get(userId);
        const remoteStudent = room.students.get(otherStudentId);
        let consumer, audioConsumer;
        try {
            consumer = await this.createConsumerForTransport(remoteStudent.producer, student.consumerTransport, rtpCapabilities);
            audioConsumer = await this.createConsumerForTransport(remoteStudent.audioProducer, student.consumerTransport, rtpCapabilities);
        } catch (err) {
            Logger.log(`err :::` + err);
        }
        remoteStudent.consumers.set(userId, { consumer, audioConsumer });
        return Promise.resolve({
            event: 'other-student-video-consumed',
            data:
            {
                producerId: remoteStudent.producer.id,
                id: consumer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                type: consumer.type,
                producerPaused: consumer.producerPaused,
                otherStudentId,
                audioProducerId: remoteStudent.audioProducer.id,
                audioId: audioConsumer.id,
                audioKind: audioConsumer.kind,
                auidoRtpParameters: audioConsumer.rtpParameters,
                audioType: audioConsumer.type,
                audioProducerPaused: audioConsumer.producerPaused,
            }
        });
    }

    @SubscribeMessage('resume-other-student-video')
    async resumeOtherStudentVideo(@MessageBody() data) {
        const { classId, userId, otherStudentId } = data;
        const room = this.rooms.get(classId);
        const remoteStudent = room.students.get(otherStudentId);
        const { consumer, audioConsumer } = remoteStudent.consumers.get(userId);
        await consumer.resume();
        await audioConsumer.resume();
        return Promise.resolve({
            event: 'other-student-video-resumed'
        });
    }

    @SubscribeMessage('get-already-joined-students')
    async getAlreadyJoinedStudents(@MessageBody() data) {
        const { classId, userId } = data;
        const room = this.rooms.get(classId);
        const studentsList = room.studentIds.filter(id => {
            const student = room.students.get(id);
            return student.socket && id !== userId && student.producer;
        });

        return Promise.resolve({
            'event': 'got-already-joined-students',
            data: studentsList
        })
    }
    /**
     * Student part end
     * 
     * Drawing part start
     */

    @SubscribeMessage('get-drawingboard')
    async getDrawingBoard(@MessageBody() data) {
        const { classId } = data;
        const dRoom = this.drawingData.get(classId);
        let drawData = [];
        if (dRoom) {
            drawData = dRoom.data;
        }

        return Promise.resolve({
            event: 'take-drawingboard',
            data: dRoom
        });
    }

    @SubscribeMessage('set-drawing-config')
    async setDrawingConfig(@MessageBody() data) {
        const { classId,
            lineSize,
            pencilColor,
            canvasBackgroundColor,
            mode } = data;

        const dRoom = this.drawingData.get(classId);
        if (!dRoom) {
            const config = {
                lineSize,
                pencilColor,
                canvasBackgroundColor,
                mode
            };
            this.drawingData.set(classId, { config, data: [] })
        }
        const room = this.rooms.get(classId);
        dRoom.config = {
            lineSize,
            pencilColor,
            canvasBackgroundColor,
            mode
        };

        room.studentIds.forEach(sId => {
            const student = room.students.get(sId);

            if (student.socket) {
                this.server.to(student.socket.id).emit('drawing-config', {
                    lineSize,
                    pencilColor,
                    canvasBackgroundColor,
                    mode
                });
            }
        });
    }

    @SubscribeMessage('teacher-send-drawing')
    async teacherSendDrawing(@MessageBody() data) {
        const { prevPos, currentPos, classId } = data;
        const dRoom = this.drawingData.get(classId);
        dRoom.data.push({ prevPos, currentPos });

        const room = this.rooms.get(classId);

        room.studentIds.forEach(sId => {
            const student = room.students.get(sId);

            if (student.socket) {
                this.server.to(student.socket.id).emit('drawing-data', { prevPos, currentPos });
            }
        });
    }

    @SubscribeMessage('clear-drawing')
    async clearDrawing(@MessageBody() data) {
        const { classId } = data;

        const dRoom = this.drawingData.get(classId);
        dRoom.data = [];
        const room = this.rooms.get(classId);

        room.studentIds.forEach(sId => {
            const student = room.students.get(sId);

            if (student.socket) {
                this.server.to(student.socket.id).emit('clear-drawing');
            }
        });
    }

    @SubscribeMessage('new-textbox-created')
    async textBoxCreated(@MessageBody() data) {
        const { classId, position, id } = data;

        const room = this.rooms.get(classId);

        room.studentIds.forEach(sId => {
            const student = room.students.get(sId);

            if (student.socket) {
                this.server.to(student.socket.id).emit('textbox-created', { position, id });
            }
        });
    }

}

