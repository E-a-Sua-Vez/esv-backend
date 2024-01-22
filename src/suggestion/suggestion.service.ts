import { Suggestion } from './suggestion.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { publish } from 'ett-events-lib';
import SuggestionCreated from './events/SuggestionCreated';

export class SuggestionService {
  constructor(
  @InjectRepository(Suggestion)
    private suggestionRepository = getRepository(Suggestion)
  ) {}

  public async getSuggestionById(id: string): Promise<Suggestion> {
    return await this.suggestionRepository.findById(id);
  }

  public async createSuggestion(type: string, comment: string, userId: string, userType: string): Promise<Suggestion> {
    let suggestion = new Suggestion();

    suggestion.type = type;
    suggestion.comment = comment;
    suggestion.userType = userType;
    suggestion.userId = userId;
    suggestion.createdAt = new Date();
    const suggestionCreated = await this.suggestionRepository.create(suggestion);

    const suggestionCreatedEvent = new SuggestionCreated(new Date(), suggestionCreated);
    publish(suggestionCreatedEvent);

    return suggestionCreated;
  }
}
