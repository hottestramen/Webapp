import { supabase } from '../supabase';
import type { AvatarColorKey, Member, MemberInsert, MemberUpdate } from '../../types';
import { ApiError, UNIQUE_VIOLATION, unwrap } from './errors';

const AVATAR_COUNT = 8;

/** 비활성 팀원도 포함해 가져온다(기존 할일에 이름을 유지해 보여주기 위해). */
export async function listMembers(): Promise<Member[]> {
  return unwrap<Member[]>(
    await supabase.from('members').select('*').order('created_at', { ascending: true }),
  );
}

export async function createMember(input: MemberInsert): Promise<Member> {
  return unwrap<Member>(await supabase.from('members').insert(input).select().single());
}

export async function updateMember(id: string, patch: MemberUpdate): Promise<Member> {
  return unwrap<Member>(
    await supabase.from('members').update(patch).eq('id', id).select().single(),
  );
}

/** 팀원 비활성화(삭제 대신). 기존 할일에는 이름이 남는다(F-U-04). */
export function deactivateMember(id: string): Promise<Member> {
  return updateMember(id, { active: false });
}

/** 아바타 색을 팔레트에서 순환해 고른다. */
export function pickAvatarColor(existingCount: number): AvatarColorKey {
  return `avatar-${(existingCount % AVATAR_COUNT) + 1}` as AvatarColorKey;
}

/**
 * 이름으로 활성 팀원을 찾고, 없으면 새로 등록한다(F-U-01, F-T-06).
 * 동시에 같은 이름이 등록되어 중복 오류가 나면 다시 조회해 기존 팀원을 돌려준다.
 */
export async function ensureMember(name: string, members: readonly Member[]): Promise<Member> {
  const found = members.find((m) => m.active && m.name === name);
  if (found) return found;

  try {
    return await createMember({ name, color: pickAvatarColor(members.length) });
  } catch (error) {
    if (error instanceof ApiError && error.code === UNIQUE_VIOLATION) {
      const existing = (await listMembers()).find((m) => m.active && m.name === name);
      if (existing) return existing;
    }
    throw error;
  }
}
