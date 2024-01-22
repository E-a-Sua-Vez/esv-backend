import { Feature } from './feature.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

export class FeatureService {
  constructor(
  @InjectRepository(Feature)
    private featureRepository = getRepository(Feature)
  ) {}

  public async getFeatureById(id: string): Promise<Feature> {
    return await this.featureRepository.findById(id);
  }
  public async getFeatureByName(name: string): Promise<Feature> {
    const result = await this.featureRepository.whereEqualTo('name', name).find();
    return result[0];
  }
  public async getAllFeature(): Promise<Feature[]> {
    return await this.featureRepository.find();
  }
  public async getFeatureByType(type: string): Promise<Feature[]> {
    return await this.featureRepository
    .whereEqualTo('type', type)
    .find();
  }
  public async getFeatureByModule(module: string): Promise<Feature[]> {
    return await this.featureRepository
    .whereEqualTo('module', module)
    .find();
  }

  public async createFeature(name, description, type, module): Promise<Feature> {
    let feature = new Feature();
    feature.name = name;
    feature.description = description;
    feature.type = type;
    feature.module = module;
    feature.active = true;
    feature.createdAt = new Date();
    const rolCreated = await this.featureRepository.create(feature);
    return rolCreated;
  }
}
