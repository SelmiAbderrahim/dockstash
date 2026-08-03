import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { loadCookie, removeCookie, saveCookie } from '@shared/utils/cookies';
import { updateGuidePreferenceRequest } from '../api';
import { guideReducer } from './slice';
import { setGuideMe } from './thunks';

vi.mock('../api', () => ({
  updateGuidePreferenceRequest: vi.fn(() => Promise.resolve({ user: { id: 'u1', guideMe: false } })),
}));

const mockedRequest = vi.mocked(updateGuidePreferenceRequest);

const makeStore = () => configureStore({ reducer: { guide: guideReducer } });

beforeEach(() => {
  removeCookie('user');
  vi.clearAllMocks();
});

describe('setGuideMe', () => {
  it('rejects when no user cookie exists', async () => {
    const store = makeStore();
    const action = await store.dispatch(setGuideMe(false));
    expect(action.type).toBe(setGuideMe.rejected.type);
    expect(mockedRequest).not.toHaveBeenCalled();
  });

  it('rejects when the cookie has no usable id', async () => {
    saveCookie('user', { email: 'a@b.c' });
    const store = makeStore();
    const action = await store.dispatch(setGuideMe(false));
    expect(action.type).toBe(setGuideMe.rejected.type);
  });

  it('calls the API with the id and spread-updates the cookie', async () => {
    saveCookie('user', { id: 'u1', email: 'a@b.c', guideMe: true });
    const store = makeStore();
    const action = await store.dispatch(setGuideMe(false));
    expect(action.type).toBe(setGuideMe.fulfilled.type);
    expect(mockedRequest).toHaveBeenCalledWith('u1', false);
    expect(loadCookie<{ guideMe?: boolean; email?: string }>('user')).toMatchObject({
      email: 'a@b.c',
      guideMe: false,
    });
    expect(store.getState().guide.enabled).toBe(false);
  });

  it('falls back to the legacy _id field', async () => {
    saveCookie('user', { _id: 'legacy', email: 'a@b.c' });
    const store = makeStore();
    await store.dispatch(setGuideMe(true));
    expect(mockedRequest).toHaveBeenCalledWith('legacy', true);
  });

  it('rejects with a message when the API fails', async () => {
    mockedRequest.mockRejectedValueOnce(new Error('down'));
    saveCookie('user', { id: 'u1' });
    const store = makeStore();
    const action = await store.dispatch(setGuideMe(false));
    expect(action.type).toBe(setGuideMe.rejected.type);
    expect(store.getState().guide.error).toBeTruthy();
  });
});
