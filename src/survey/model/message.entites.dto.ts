class Entity {
  name: string;
  type: string;
  score: number;
  salience: number;
}

export class MessageEntitiesDto {
  entities?: Entity[];
}
