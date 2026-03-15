import axios from 'axios';

import { NanoAgentService } from '../nano-agent.service';
import { FlowNode } from '../../dto/flow-mapper-config.dto';
import { NanoAgentException } from '../../exceptions/flow-mapper.exceptions';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const makeNode = (overrides: Partial<FlowNode> = {}): FlowNode => ({
  id: 'src/user.service.ts:UserService#create:10',
  label: 'create',
  type: 'service',
  filePath: 'src/user.service.ts',
  lineNumber: 10,
  rawBody: 'async create(dto) { return this.repo.save(dto); }',
  docstring: 'Creates a new user record.',
  customTag: 'Persist new user to database',
  ...overrides,
});

describe('NanoAgentService', () => {
  let service: NanoAgentService;

  beforeEach(() => {
    service = new NanoAgentService('test-api-key');
    jest.clearAllMocks();
  });

  describe('summarize()', () => {
    it('returns the trimmed text from the API response', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: { content: [{ text: '  Saves user entity to persistence layer  ' }] },
      });

      const result = await service.summarize(makeNode());
      expect(result).toBe('Saves user entity to persistence layer');
    });

    it('injects the raw body, docstring, and custom tag into the prompt', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: { content: [{ text: 'summary' }] },
      });

      await service.summarize(makeNode());

      const payload = (mockedAxios.post as jest.Mock).mock.calls[0][1];
      const prompt: string = payload.messages[0].content;

      expect(prompt).toContain('async create(dto)');
      expect(prompt).toContain('Creates a new user record.');
      expect(prompt).toContain('Persist new user to database');
    });

    it('omits the docstring section when docstring is undefined', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: { content: [{ text: 'summary' }] },
      });

      await service.summarize(makeNode({ docstring: undefined }));

      const payload = (mockedAxios.post as jest.Mock).mock.calls[0][1];
      const prompt: string = payload.messages[0].content;

      expect(prompt).not.toContain('JSDoc:');
    });

    it('throws NanoAgentException on a non-2xx API response', async () => {
      // Set isAxiosError on the error object itself so axios.isAxiosError() returns true
      // without needing to replace the type-predicate function on the mock.
      const axiosError = Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        response: { data: { error: { message: 'invalid_api_key' } } },
      });
      mockedAxios.post = jest.fn().mockRejectedValue(axiosError);

      await expect(service.summarize(makeNode())).rejects.toThrow(NanoAgentException);
    });

    it('throws NanoAgentException on a network-level error', async () => {
      // Plain Error has no isAxiosError property — axios.isAxiosError() returns false,
      // so the catch branch falls through to the generic (err as Error).message path.
      mockedAxios.post = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.summarize(makeNode())).rejects.toThrow(NanoAgentException);
    });
  });
});
