import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  // Booted once, not per test: `AppModule` starts queue workers, schedulers and
  // Redis/Postgres connections, and a fresh instance per test leaks all of them.
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Same pipeline as `bootstrap()`. Without it this suite exercised a bare
    // app: no interceptors, so `/` returned the raw string and the assertion
    // below claimed a response shape production has never sent.
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    // Runs the shutdown hooks that close those connections. Without this the
    // suite passes and then hangs forever waiting on open handles.
    await app?.close();
    // Closing shuts down queue workers and their Redis connections, which
    // takes longer than jest's 5s default hook timeout.
  }, 60000);

  // `TransformInterceptor` wraps every non-paginated payload in `{ data }`, so
  // this is the body a real caller receives. `/` is one of the paths excluded
  // from the `/v1` prefix, which is why it is still reachable at the root.
  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({ data: 'Hello World!' });
  });
});
