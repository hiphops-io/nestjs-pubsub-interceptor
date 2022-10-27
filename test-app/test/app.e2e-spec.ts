import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let msgPayload: any;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Construct a base message payload for the tests to send.
    const someDtoB64 = Buffer.from(
      '{"someString":"mystring", "someNumber":1}',
    ).toString('base64');

    msgPayload = {
      subscription: 'projects/a-gcp-project/subscriptions/test-pubsub-message',
      message: {
        data: someDtoB64,
        messageId: '1',
        attributes: {
          foo: 'bar',
        },
      },
    };
  });

  it('/task-request (POST) should handle b64 encoded messages', () => {
    return request(app.getHttpServer()).post('/').send(msgPayload).expect(201);
  });

  it('/task-request (POST) should return the correct string', () => {
    return request(app.getHttpServer())
      .post('/')
      .send(msgPayload)
      .expect(201)
      .expect('mystring');
  });

  it('/task-request (POST) should return 400 for non b64 encoding', () => {
    msgPayload.message.data = 'Some non-base64 string';

    return request(app.getHttpServer()).post('/').send(msgPayload).expect(400);
  });

  it('/task-request (POST) should return 400 for bad message format', () => {
    // Delete a required key
    delete msgPayload.message.data;

    return request(app.getHttpServer()).post('/').send(msgPayload).expect(400);
  });

  it('/task-request (POST) should return 400 for bad SomeDto format', () => {
    const badTaskContext = Buffer.from('{"foo":"bar"}').toString('base64');
    msgPayload.message.data = badTaskContext;

    return request(app.getHttpServer()).post('/').send(msgPayload).expect(400);
  });

  it('/task-request (POST) should add header based on attributes', (done) => {
    request(app.getHttpServer())
      .post('/headers')
      .send(msgPayload)
      .expect(200)
      .end(function (err, res) {
        expect(res.body['x-pubsub-foo']).toBe('bar');
        done();
      });
  });
});
