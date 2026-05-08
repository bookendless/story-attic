/**
 * AI設定タブ
 * SettingsModal 内の「AI」タブとして表示される。
 * プロバイダー選択・APIキー管理・モデル設定・接続テスト・システムプロンプトを提供する。
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { AiSettings } from '@/shared/types';
import { DEFAULT_AI_SETTINGS } from '@/shared/types';

const AI_PROVIDERS = [
  { value: '', label: '-- 選択 --' },
  { value: 'openai', label: 'OpenAI (GPT-4o 等)' },
  { value: 'anthropic', label: 'Anthropic (Claude 等)' },
  { value: 'google', label: 'Google (Gemini 等)' },
  { value: 'xai', label: 'xAI (Grok 等)' },
  { value: 'local', label: 'ローカルLLM (Ollama 等)' },
];

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-6',
  google: 'gemini-2.5-flash',
  xai: 'grok-4',
  local: 'llama3.2',
};

const MODEL_PLACEHOLDER: Record<string, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-6',
  google: 'gemini-2.5-flash',
  xai: 'grok-4',
  local: 'llama3.2',
};

export { DEFAULT_MODELS };

interface AiSettingsTabProps {
  value: AiSettings;
  onChange: (settings: AiSettings) => void;
  /** SettingsRow コンポーネント — SettingsModal 側から注入 */
  SettingRow: React.ComponentType<{ label: string; children: React.ReactNode }>;
}

export function AiSettingsTab({ value, onChange, SettingRow }: AiSettingsTabProps) {
  const [apiKey, setApiKey] = useState('');
  const [keySaving, setKeySaving] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // プロバイダー切替時にキーリングへ保存済みかをプローブし UI 状態を同期する
  useEffect(() => {
    let cancelled = false;
    setKeyError(null);
    setKeySaved(false);
    setTestResult(null);
    if (!value.provider) return;
    invoke<boolean>('has_api_key', { service: value.provider })
      .then((exists) => {
        if (!cancelled && exists) setKeySaved(true);
      })
      .catch(() => {
        // プローブ失敗は致命ではないので silent (エラー UI は鍵操作時のみ)
      });
    return () => { cancelled = true; };
  }, [value.provider]);

  const update = (patch: Partial<AiSettings>) => {
    onChange({ ...value, ...patch });
  };

  const handleProviderChange = (newProvider: string) => {
    update({
      provider: newProvider,
      model: value.model && !Object.values(DEFAULT_MODELS).includes(value.model)
        ? value.model
        : (DEFAULT_MODELS[newProvider] ?? ''),
    });
  };

  const handleSaveApiKey = useCallback(async () => {
    if (!apiKey.trim() || !value.provider) return;
    setKeySaving(true);
    setKeyError(null);
    try {
      await invoke('save_api_key', { service: value.provider, apiKey: apiKey.trim() });
      setKeySaved(true);
      setApiKey('');
    } catch (e) {
      const msg = String(e);
      setKeyError(`保存に失敗しました: ${msg}`);
      setKeySaved(false);
    } finally {
      setKeySaving(false);
    }
  }, [apiKey, value.provider]);

  const handleTestConnection = useCallback(async () => {
    if (!value.provider) return;
    setTestResult(null);
    try {
      const msg = await invoke<string>('ai_test_connection', {
        service: value.provider,
        baseUrl: value.base_url,
      });
      setTestResult({ ok: true, message: msg });
    } catch (e) {
      setTestResult({ ok: false, message: String(e) });
    }
  }, [value.provider, value.base_url]);

  return (
    <>
      <SettingRow label="プロバイダー">
        <select
          className="input text-sm"
          style={{ width: '200px', padding: '4px 8px' }}
          value={value.provider}
          onChange={(e) => handleProviderChange(e.target.value)}
        >
          {AI_PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </SettingRow>

      {value.provider && (
        <>
          <SettingRow label="APIキー">
            <div className="flex flex-col gap-1" style={{ alignItems: 'flex-end' }}>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  className="input text-sm"
                  style={{ width: '140px', padding: '4px 8px' }}
                  placeholder={keySaved ? '保存済み ✓' : '入力して保存'}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setKeyError(null); }}
                />
                <button
                  className="btn btn-ghost text-xs"
                  style={{ padding: '3px 10px' }}
                  onClick={handleSaveApiKey}
                  disabled={!apiKey.trim() || keySaving}
                >
                  {keySaving ? '保存中...' : keySaved && !apiKey ? '保存済み' : '保存'}
                </button>
              </div>
              {keyError && (
                <span className="text-xs" style={{ color: 'var(--warning, #c66)' }}>
                  {keyError}
                </span>
              )}
            </div>
          </SettingRow>

          <SettingRow label="モデル">
            <input
              type="text"
              className="input text-sm"
              style={{ width: '200px', padding: '4px 8px' }}
              placeholder={MODEL_PLACEHOLDER[value.provider] ?? ''}
              value={value.model}
              onChange={(e) => update({ model: e.target.value })}
            />
          </SettingRow>

          {value.provider === 'local' && (
            <SettingRow label="ベースURL">
              <input
                type="text"
                className="input text-sm"
                style={{ width: '200px', padding: '4px 8px' }}
                placeholder="http://localhost:11434/v1"
                value={value.base_url ?? ''}
                onChange={(e) => update({ base_url: e.target.value || null })}
              />
            </SettingRow>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--text-mid)' }}>接続テスト</span>
            <div className="flex items-center gap-2">
              {testResult && (
                <span
                  className="text-xs"
                  style={{ color: testResult.ok ? 'var(--success, #5a9)' : 'var(--warning)' }}
                >
                  {testResult.message}
                </span>
              )}
              <button
                className="btn btn-ghost text-xs"
                style={{ padding: '3px 10px' }}
                onClick={handleTestConnection}
              >
                テスト
              </button>
            </div>
          </div>

          <div>
            <span className="text-sm" style={{ color: 'var(--text-mid)' }}>システムプロンプト</span>
            <textarea
              className="w-full mt-2 text-xs"
              rows={5}
              placeholder="AIへの基本的な指示（役割・口調・禁止事項など）"
              value={value.system_prompt}
              onChange={(e) => update({ system_prompt: e.target.value })}
              style={{
                background: 'var(--bg-deep)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '8px',
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: '1.6',
              }}
            />
          </div>
        </>
      )}
    </>
  );
}

export { DEFAULT_AI_SETTINGS };
