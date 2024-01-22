import { Collection } from 'fireorm';
import { User } from 'src/user/user.entity';

@Collection('attention')
export class Attention {
    id: string;
    commerceId: string;
    collaboratorId: string;
    createdAt: Date;
    endAt: Date;
    number: number;
    queueId: string;
    status: string;
    userId: string;
    moduleId: string;
    comment: string;
    surveyId: string;
    reactivatedAt: Date;
    reactivated: boolean;
    duration: number;
    type: string;
    assistingCollaboratorId: string;
    notificationOn: boolean = false;
    notificationEmailOn: boolean = false;
    channel: string;
    user: User;
    ratedAt: Date;
    rateDuration: number;
}