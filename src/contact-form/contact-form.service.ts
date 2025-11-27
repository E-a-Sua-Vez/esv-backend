import { Injectable, Inject } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { GcpLoggerService } from '../shared/logger/gcp-logger.service';

import { ContactFormSubmission } from './model/contact-form.entity';

interface ContactFormEventData {
  data?: {
    attributes?: {
      id?: string;
      name?: string;
      email?: string;
      phone?: string;
      company?: string;
      message?: string;
      source?: string;
      page?: string;
    };
  };
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ContactFormService {
  constructor(
    @InjectRepository(ContactFormSubmission)
    private contactFormRepository = getRepository(ContactFormSubmission),
    @Inject(GcpLoggerService)
    private readonly logger: GcpLoggerService
  ) {
    this.logger.setContext('ContactFormService');
  }

  /**
   * Process a contact form submission event from the event store
   * @param eventData - The event data from the event store
   * @returns The created ContactFormSubmission
   */
  public async processContactFormEvent(
    eventData: ContactFormEventData
  ): Promise<ContactFormSubmission> {
    try {
      this.logger.log(`Processing contact form event: ${eventData?.data?.attributes?.id}`);

      // Extract event attributes
      const attributes = eventData?.data?.attributes || {};
      const metadata = eventData?.metadata || {};

      // Check if submission already exists (idempotency)
      const existingSubmission = await this.contactFormRepository
        .whereEqualTo('eventId', eventData?.data?.id || attributes?.id)
        .findOne();

      if (existingSubmission) {
        this.logger.log(`Contact form submission already exists: ${existingSubmission.id}`);
        return existingSubmission;
      }

      // Create new submission
      const submission = new ContactFormSubmission();
      submission.id = attributes.id || eventData?.data?.id;
      submission.name = attributes.name || '';
      submission.email = attributes.email || '';
      submission.phone = attributes.phone || '';
      submission.company = attributes.company || '';
      submission.message = attributes.message || '';
      submission.source = attributes.source || 'contact-form';
      submission.page = attributes.page || '';
      submission.eventId = eventData?.data?.id || attributes.id;
      submission.eventOccurredOn = eventData?.data?.occurredOn
        ? new Date(eventData.data.occurredOn)
        : new Date();
      submission.createdAt = new Date();
      submission.processedAt = new Date();
      submission.metadata = {
        origin: metadata.origin,
        userAgent: metadata.userAgent,
        timestamp: metadata.timestamp,
      };

      const created = await this.contactFormRepository.create(submission);
      this.logger.log(`Contact form submission created: ${created.id}`);

      return created;
    } catch (error) {
      this.logger.error(`Error processing contact form event: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all contact form submissions
   * @param limit - Maximum number of results
   * @param offset - Number of results to skip
   * @returns Array of ContactFormSubmission
   */
  public async getSubmissions(limit = 50, offset = 0): Promise<ContactFormSubmission[]> {
    try {
      const submissions = await this.contactFormRepository
        .orderByDescending('createdAt')
        .limit(limit)
        .offset(offset)
        .find();

      return submissions;
    } catch (error) {
      this.logger.error(`Error getting submissions: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get contact form submission by ID
   * @param id - Submission ID
   * @returns ContactFormSubmission or null
   */
  public async getSubmissionById(id: string): Promise<ContactFormSubmission> {
    try {
      const submission = await this.contactFormRepository.findById(id);
      return submission;
    } catch (error) {
      this.logger.error(`Error getting submission by ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get submissions by source
   * @param source - Source type ('contact-form' or 'exit-intent')
   * @param limit - Maximum number of results
   * @param offset - Number of results to skip
   * @returns Array of ContactFormSubmission
   */
  public async getSubmissionsBySource(
    source: string,
    limit = 50,
    offset = 0
  ): Promise<ContactFormSubmission[]> {
    try {
      const submissions = await this.contactFormRepository
        .whereEqualTo('source', source)
        .orderByDescending('createdAt')
        .limit(limit)
        .offset(offset)
        .find();

      return submissions;
    } catch (error) {
      this.logger.error(`Error getting submissions by source: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get submissions by email
   * @param email - Email address
   * @returns Array of ContactFormSubmission
   */
  public async getSubmissionsByEmail(email: string): Promise<ContactFormSubmission[]> {
    try {
      const submissions = await this.contactFormRepository
        .whereEqualTo('email', email)
        .orderByDescending('createdAt')
        .find();

      return submissions;
    } catch (error) {
      this.logger.error(`Error getting submissions by email: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get total count of submissions
   * @returns Total count
   */
  public async getTotalCount(): Promise<number> {
    try {
      const allSubmissions = await this.contactFormRepository.find();
      return allSubmissions.length;
    } catch (error) {
      this.logger.error(`Error getting total count: ${error.message}`, error.stack);
      throw error;
    }
  }
}
