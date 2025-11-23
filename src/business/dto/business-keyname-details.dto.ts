import { Commerce } from 'src/commerce/model/commerce.entity';

export class BusinessKeyNameDetailsDto {
  id: string;
  name: string;
  keyName: string;
  logo: string;
  active: boolean;
  available: boolean;
  category: string;
  commerces: Commerce[];
}
