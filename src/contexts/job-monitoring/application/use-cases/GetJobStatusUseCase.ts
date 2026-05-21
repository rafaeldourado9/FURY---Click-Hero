import type { JobStatusReader, JobStatus } from '../ports/JobStatusReader';

/**
 * Caso de uso de consulta de status de job.
 *
 * Hoje delega 1:1 ao reader. Existe para manter o controller HTTP livre
 * de dependência direta de infraestrutura (BullMQ); o reader pode ser
 * substituído por mock em teste ou por outra fonte no futuro.
 */
export class GetJobStatusUseCase {
  constructor(private readonly reader: JobStatusReader) {}

  async execute(jobId: string): Promise<JobStatus | null> {
    return this.reader.findById(jobId);
  }
}
