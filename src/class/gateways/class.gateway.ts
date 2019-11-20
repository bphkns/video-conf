import { MessageBody, OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer, WsResponse, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ClassDetails } from '../../entities/class.entity';
import { ClassService } from '../class.service';

@WebSocketGateway({ namespace: 'class-events', path: '/class' })
export class ClassGateway implements OnGatewayConnection {

    @WebSocketServer()
    server: Server;

    constructor(private classService: ClassService) { }

    @SubscribeMessage('get-active-classes')
    async findAllClasses(@MessageBody() data: any): Promise<WsResponse<ClassDetails[]>> {
        const classes = await this.classService.getLiveClasses();
        return Promise.resolve({
            event: 'live-classes',
            data: classes,
        });
    }

    @SubscribeMessage('identity')
    async identity(@MessageBody() data: number): Promise<number> {
        return data;
    }

    @SubscribeMessage('get-owner')
    async getOwner(@MessageBody() data, @ConnectedSocket() client: Socket) {
        const teacher = await this.classService.getOwner(data);
        return Promise.resolve({
            event: 'owner-details',
            data: teacher,
        });
    }

    handleConnection(client: Socket, ...args: any[]) { }
}
