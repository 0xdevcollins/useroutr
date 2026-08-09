import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsProcessor } from './notifications.processor';
import { Resend } from 'resend';
import { Job } from 'bullmq';
import { EmailJobData } from './types';

jest.mock('resend');

describe('NotificationsProcessor', () => {
  let processor: NotificationsProcessor;
  let mockSend: jest.Mock;

  beforeEach(async () => {
    mockSend = jest.fn();

    (Resend as jest.Mock).mockImplementation(() => ({
      emails: { send: mockSend },
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsProcessor,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                RESEND_API_KEY: 're_test_key',
                EMAIL_FROM: 'test@useroutr.com',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    processor = module.get<NotificationsProcessor>(NotificationsProcessor);
  });

  it('should process sendEmail jobs successfully', async () => {
    mockSend.mockResolvedValue({
      data: { id: 'test-id' },
      error: null,
    });

    const job: Job<EmailJobData> = {
      name: 'sendEmail',
      data: {
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      },
    } as Job<EmailJobData>;

    await processor.process(job);

    expect(mockSend).toHaveBeenCalledWith({
      from: 'test@useroutr.com',
      to: ['user@example.com'],
      subject: 'Test Subject',
      html: '<p>Test</p>',
    });
  });

  it('should pass attachments to Resend when provided', async () => {
    mockSend.mockResolvedValue({
      data: { id: 'test-id' },
      error: null,
    });

    const job: Job<EmailJobData> = {
      name: 'sendEmail',
      data: {
        to: 'user@example.com',
        subject: 'Invoice',
        html: '<p>Invoice</p>',
        attachments: [
          { filename: 'invoice.pdf', path: 'https://example.com/invoice.pdf' },
        ],
      },
    } as Job<EmailJobData>;

    await processor.process(job);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          {
            filename: 'invoice.pdf',
            path: 'https://example.com/invoice.pdf',
          },
        ],
      }),
    );
  });

  it('should throw error when resend fails', async () => {
    const errorMsg = 'Failed to send';
    mockSend.mockResolvedValue({
      data: null,
      error: { message: errorMsg },
    });

    const job: Job<EmailJobData> = {
      name: 'sendEmail',
      data: {
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      },
    } as Job<EmailJobData>;

    await expect(processor.process(job)).rejects.toThrow(errorMsg);
  });

  it('constructs without RESEND_API_KEY, and fails only when sending', async () => {
    // Deliberately changed: this used to throw at construction, which made
    // transactional email a hard boot dependency for the whole API. Now the
    // app starts and the error surfaces on the job that actually needs a key,
    // where it is already logged and retried.
    const module = await Test.createTestingModule({
      providers: [
        NotificationsProcessor,
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => undefined) },
        },
      ],
    }).compile();

    const unconfigured = module.get<NotificationsProcessor>(
      NotificationsProcessor,
    );
    expect(unconfigured).toBeDefined();

    // The error must still reach whoever tries to send, naming the variable.
    await expect(
      unconfigured.process({
        name: 'sendEmail',
        data: { to: 'user@example.com', subject: 's', html: '<p>h</p>' },
      } as Job<EmailJobData>),
    ).rejects.toThrow('RESEND_API_KEY');
  });
});
