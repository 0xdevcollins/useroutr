import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiOptions,
} from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private configured = false;

  constructor(private readonly config: ConfigService) {}

  /**
   * Configure Cloudinary on first use rather than at construction.
   *
   * `getOrThrow` in the constructor made an optional integration a hard boot
   * dependency: without Cloudinary credentials the provider failed to
   * instantiate, which takes the entire AppModule down. An API that cannot
   * start because nobody configured image uploads is a worse failure than an
   * upload that fails when someone actually tries one.
   */
  private ensureConfigured(): void {
    if (this.configured) return;

    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');

    const missing = [
      !cloudName && 'CLOUDINARY_CLOUD_NAME',
      !apiKey && 'CLOUDINARY_API_KEY',
      !apiSecret && 'CLOUDINARY_API_SECRET',
    ].filter(Boolean);

    if (missing.length > 0) {
      // Name the variables. "Upload failed" sends someone reading Cloudinary
      // docs; this sends them to their env file.
      throw new InternalServerErrorException(
        `File storage is not configured: missing ${missing.join(', ')}`,
      );
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
    this.configured = true;
  }

  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    this.ensureConfigured();

    const publicId = key.replace(/\.[^/.]+$/, '').replace(/\//g, '_');

    const options: UploadApiOptions = {
      public_id: publicId,
      resource_type: 'raw',
      overwrite: true,
      format: contentType === 'application/pdf' ? 'pdf' : undefined,
    };

    const result = await this.uploadBuffer(body, options);

    this.logger.log(`Uploaded file to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  }

  async delete(publicId: string): Promise<void> {
    this.ensureConfigured();

    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    this.logger.log(`Deleted file from Cloudinary: ${publicId}`);
  }

  // Cloudinary secure_url is permanent — no pre-signing needed.
  getSignedUrl(secureUrl: string): string {
    return secureUrl;
  }

  private uploadBuffer(
    buffer: Buffer,
    options: UploadApiOptions,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error ?? !result) {
            reject(
              new InternalServerErrorException(
                error?.message ?? 'Cloudinary upload failed',
              ),
            );
            return;
          }
          resolve(result);
        },
      );

      Readable.from(buffer).pipe(stream);
    });
  }
}
