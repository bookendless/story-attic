import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { AiSettings } from '@/shared/types';
import { Row, Section, Badge } from '../atoms';

interface AiPanelProps {
  draftAi: AiSettings;
  onAiChange: (settings: AiSettings) => void;
}

const AI_PROVIDERS = [
  { value: '', label: '-- 選択 --' },
  { value: 'openai',    label: 'OpenAI (GPT-4o 等)' },
  { value: 'anthropic', label: 'Anthropic (Claude 等)' },
  { value: 'google',    label: 'Google (Gemini 等)' },
  { value: 'xai',       label: 'xAI (Grok 等)' },
  { value: 'local',     label: 'ローカルLLM (Ollama 等)' },
];

const DEFAULT_MODELS: Record<string, string> = {
  openai:    'gpt-5.4-mini',
  anthropic: 'claude-sonnet-4-6',
  google:    'gemini-3.1-flash-lite',
  xai:       'grok-4-1-fast-reasoning',
  local:     'llama3.2',
};

const MODEL_PLACEHOLDER: Record<string, string> = {
  openai:    'gpt-5.4-mini',
  anthropic: 'claude-sonnet-4-6',
  google:    'gemini-3.1-flash-lite',
  xai:       'grok-4-1-fast-reasoning',
  local:     'llama3.2',
};

const SUGGESTED_MODELS: Record<string, string[]> = {
  openai:    ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-4o', 'o4-mini'],
  anthropic: ['claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  google:    ['gemini-3.1-pro-preview', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-2.5-pro'],
  xai:       ['grok-4.20-0309-reasoning', 'grok-4.20-0309-non-reasoning', 'grok-4-1-fast-reasoning', 'grok-4-1-fast-non-reasoning'],
  local:     ['llama3.2', 'llama3.1', 'mistral', 'phi4', 'qwen2.5'],
};

export function AiPanel({ draftAi, onAiChange }: AiPanelProps) {
  const [apiKey, setApiKey] = useState('');
  const [keySaving, setKeySaving] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [charCount, setCharCount] = useState(draftAi.system_prompt.length);

  // プロバイダー切替時にキーリングへ保存済みかをプローブ
  useEffect(() => {
    let cancelled = false;
    setKeyError(null);
    setKeySaved(false);
    setTestResult(null);
    if (!draftAi.provider || draftAi.provider === 'local') return;
    invoke<boolean>('has_api_key', { service: draftAi.provider })
      .then((exists) => { if (!cancelled && exists) setKeySaved(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [draftAi.provider]);

  const update = (patch: Partial<AiSettings>) => onAiChange({ ...draftAi, ...patch });

  const handleProviderChange = (newProvider: string) => {
    update({
      provider: newProvider,
      model: draftAi.model && !Object.values(DEFAULT_MODELS).includes(draftAi.model)
        ? draftAi.model
        : (DEFAULT_MODELS[newProvider] ?? ''),
    });
  };

  const handleSaveApiKey = useCallback(async () => {
    if (!apiKey.trim() || !draftAi.provider) return;
    setKeySaving(true);
    setKeyError(null);
    try {
      await invoke('save_api_key', { service: draftAi.provider, apiKey: apiKey.trim() });
      setKeySaved(true);
      setApiKey('');
    } catch (e) {
      setKeyError(`保存に失敗しました: ${String(e)}`);
      setKeySaved(false);
    } finally {
      setKeySaving(false);
    }
  }, [apiKey, draftAi.provider]);

  const handleTestConnection = useCallback(async () => {
    if (!draftAi.provider) return;
    setTestResult(null);
    try {
      const msg = await invoke<string>('ai_test_connection', {
        service: draftAi.provider,
        baseUrl: draftAi.base_url,
      });
      setTestResult({ ok: true, message: msg });
    } catch (e) {
      setTestResult({ ok: false, message: String(e) });
    }
  }, [draftAi.provider, draftAi.base_url]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* プロバイダー */}
      <Section title="プロバイダー">
        <Row label="AIサービス">
          <select
            className="input text-sm"
            style={{ width: '200px', padding: '4px 8px' }}
            value={draftAi.provider}
            onChange={(e) => handleProviderChange(e.target.value)}
          >
            {AI_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </Row>

        {draftAi.provider && (
          <>
            {/* APIキー（local は認証不要のため非表示） */}
            {draftAi.provider !== 'local' && (
              <Row label="APIキー" desc="OS のキーリングに暗号化保存されます">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {keySaved && !apiKey && <Badge color="success">保存済み ✓</Badge>}
                    <input
                      type="password"
                      className="input text-sm"
                      style={{ width: '160px', padding: '4px 8px' }}
                      placeholder={keySaved ? '変更する場合は入力' : '入力して保存'}
                      value={apiKey}
                      onChange={(e) => { setApiKey(e.target.value); setKeyError(null); }}
                    />
                    <button
                      className="btn btn-ghost text-xs"
                      style={{ padding: '3px 10px' }}
                      onClick={handleSaveApiKey}
                      disabled={!apiKey.trim() || keySaving}
                    >
                      {keySaving ? '保存中...' : '保存'}
                    </button>
                  </div>
                  {keyError && (
                    <span style={{ fontSize: '11px', color: 'var(--warning)' }}>{keyError}</span>
                  )}
                </div>
              </Row>
            )}

            {/* モデル（local は起動中モデルを使用するため任意） */}
            <Row
              label={draftAi.provider === 'local' ? 'モデル (任意)' : 'モデル'}
              desc={draftAi.provider === 'local'
                ? 'LMStudioは起動中モデルを自動使用 / Ollamaはモデル名必須'
                : `推奨: ${MODEL_PLACEHOLDER[draftAi.provider] ?? ''}`}
            >
              <div>
                <input
                  type="text"
                  list={`model-list-${draftAi.provider}`}
                  className="input text-sm"
                  style={{ width: '200px', padding: '4px 8px' }}
                  placeholder={draftAi.provider === 'local' ? 'LMStudio省略可 / Ollama必須' : (MODEL_PLACEHOLDER[draftAi.provider] ?? '')}
                  value={draftAi.model}
                  onChange={(e) => update({ model: e.target.value })}
                />
                <datalist id={`model-list-${draftAi.provider}`}>
                  {(SUGGESTED_MODELS[draftAi.provider] ?? []).map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            </Row>

            {/* ベースURL（ローカルのみ） */}
            {draftAi.provider === 'local' && (
              <Row label="ベースURL" desc="Ollama のデフォルト: http://localhost:11434/v1">
                <input
                  type="text"
                  className="input text-sm"
                  style={{ width: '240px', padding: '4px 8px' }}
                  placeholder="http://localhost:11434/v1"
                  value={draftAi.base_url ?? ''}
                  onChange={(e) => update({ base_url: e.target.value || null })}
                />
              </Row>
            )}

            {/* 接続テスト */}
            <Row label="接続テスト">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {testResult && (
                  <span style={{ fontSize: '12px', color: testResult.ok ? 'var(--success)' : 'var(--warning)' }}>
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
            </Row>
          </>
        )}
      </Section>

      {/* システムプロンプト */}
      <Section title="システムプロンプト">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <textarea
            rows={6}
            placeholder="AIへの基本的な指示（役割・口調・禁止事項など）"
            value={draftAi.system_prompt}
            onChange={(e) => { update({ system_prompt: e.target.value }); setCharCount(e.target.value.length); }}
            style={{
              width: '100%',
              background: 'var(--bg-deep)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '8px',
              resize: 'vertical',
              fontFamily: 'inherit',
              fontSize: '13px',
              lineHeight: '1.6',
            }}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
            {charCount} 文字
          </span>
        </div>
      </Section>
    </div>
  );
}
