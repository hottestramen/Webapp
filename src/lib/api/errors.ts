import type { PostgrestError } from '@supabase/supabase-js';

export class ApiError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

/** 낙관적 동시성(updated_at 조건) 업데이트가 0행을 갱신했을 때(PRD §5.8) */
export class ConflictError extends ApiError {
  constructor() {
    super('다른 팀원이 먼저 수정했습니다.', 'conflict');
    this.name = 'ConflictError';
  }
}

/** PostgreSQL 고유 제약 위반(예: 활성 팀원 이름 중복) */
export const UNIQUE_VIOLATION = '23505';

export function toApiError(error: PostgrestError): ApiError {
  return new ApiError(error.message, error.code);
}

/** supabase-js 응답에서 데이터만 꺼내고, 오류면 ApiError 로 던진다. */
export function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw toApiError(result.error);
  if (result.data === null) throw new ApiError('응답이 비어 있습니다.');
  return result.data;
}
