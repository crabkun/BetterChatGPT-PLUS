import React, { useEffect, useState } from 'react';
import useStore from '@store/store';
import { useTranslation, Trans } from 'react-i18next';

import PopupModal from '@components/PopupModal';
import CrossIcon from '@icon/CrossIcon';
import { ApiProvider } from '@type/provider';

const ApiPopup = () => {
  const { t } = useTranslation(['main', 'api']);

  const apiKey = useStore((state) => state.apiKey);
  const setApiKey = useStore((state) => state.setApiKey);
  const apiProvider = useStore((state) => state.apiProvider);
  const setApiProvider = useStore((state) => state.setApiProvider);
  const geminiApiKey = useStore((state) => state.geminiApiKey);
  const setGeminiApiKey = useStore((state) => state.setGeminiApiKey);
  const apiKeyConfigured = useStore((state) => state.apiKeyConfigured);
  const setApiKeyConfigured = useStore((state) => state.setApiKeyConfigured);
  const setFirstVisit = useStore((state) => state.setFirstVisit);

  const [_apiProvider, _setApiProvider] = useState<ApiProvider>(apiProvider);
  const [_apiKey, _setApiKey] = useState<string>(apiKey || '');
  const [_geminiApiKey, _setGeminiApiKey] = useState<string>(geminiApiKey);
  const [hasHydrated, setHasHydrated] = useState<boolean>(
    useStore.persist.hasHydrated()
  );
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const isGemini =
    _apiProvider === 'gemini-aistudio' || _apiProvider === 'gemini-vertexai';

  const handleConfirm = () => {
    const key = isGemini ? _geminiApiKey : _apiKey;
    if (key.length === 0) {
      setError(t('noApiKeyWarning', { ns: 'api' }) as string);
    } else {
      setError('');
      setApiProvider(_apiProvider);
      if (isGemini) {
        setGeminiApiKey(_geminiApiKey);
      } else {
        setApiKey(_apiKey);
      }
      setApiKeyConfigured(true);
      setIsModalOpen(false);
    }
  };

  useEffect(() => {
    if (hasHydrated) {
      setFirstVisit(false);
      setIsModalOpen(!apiKeyConfigured);
    }
  }, [apiKeyConfigured, hasHydrated, setFirstVisit]);

  useEffect(() => {
    if (hasHydrated) return;
    const unsubscribe = useStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });
    return () => {
      unsubscribe();
    };
  }, [hasHydrated]);

  return isModalOpen ? (
    <PopupModal
      title='Setup your API key'
      handleConfirm={handleConfirm}
      setIsModalOpen={setIsModalOpen}
      cancelButton={false}
    >
      <div className='p-6 border-b border-gray-200 dark:border-gray-600'>
        {/* Provider Selector */}
        <div className='flex gap-2 items-center justify-center mb-4'>
          <div className='min-w-fit text-gray-900 dark:text-gray-300 text-sm'>
            {t('provider.label', { ns: 'api' })}
          </div>
          <select
            className='text-gray-800 dark:text-white p-2 text-sm border-none bg-gray-200 dark:bg-gray-600 rounded-md m-0 w-full h-8 focus:outline-none'
            value={_apiProvider}
            onChange={(e) => {
              _setApiProvider(e.target.value as ApiProvider);
              setError('');
            }}
          >
            <option value='openai'>
              {t('provider.openai', { ns: 'api' })}
            </option>
            <option value='gemini-aistudio'>
              {t('provider.geminiAiStudio', { ns: 'api' })}
            </option>
            <option value='gemini-vertexai'>
              {t('provider.geminiVertexAi', { ns: 'api' })}
            </option>
          </select>
        </div>

        {/* API Key Input */}
        <div className='flex gap-2 items-center justify-center mt-2'>
          <div className='min-w-fit text-gray-900 dark:text-gray-300 text-sm'>
            {isGemini
              ? t('gemini.apiKeyLabel', { ns: 'api' })
              : t('apiKey.inputLabel', { ns: 'api' })}
          </div>
          <input
            type='text'
            className='text-gray-800 dark:text-white p-3 text-sm border-none bg-gray-200 dark:bg-gray-600 rounded-md m-0 w-full mr-0 h-8 focus:outline-none'
            value={isGemini ? _geminiApiKey : _apiKey}
            onChange={(e) => {
              if (isGemini) {
                _setGeminiApiKey(e.target.value);
              } else {
                _setApiKey(e.target.value);
              }
            }}
          />
        </div>

        {/* How-to link */}
        <div className='min-w-fit text-gray-900 dark:text-gray-300 text-sm mt-4'>
          {_apiProvider === 'openai' && (
            <Trans
              i18nKey='apiKey.howTo'
              ns='api'
              components={[
                <a
                  href='https://platform.openai.com/account/api-keys'
                  className='link'
                  target='_blank'
                />,
              ]}
            />
          )}
          {_apiProvider === 'gemini-aistudio' && (
            <Trans
              i18nKey='gemini.aiStudioHowTo'
              ns='api'
              components={[
                <a
                  href='https://aistudio.google.com/apikey'
                  className='link'
                  target='_blank'
                />,
              ]}
            />
          )}
          {_apiProvider === 'gemini-vertexai' && (
            <Trans
              i18nKey='gemini.vertexAiHowTo'
              ns='api'
              components={[
                <a
                  href='https://console.cloud.google.com/apis/credentials'
                  className='link'
                  target='_blank'
                />,
              ]}
            />
          )}
        </div>

        <div className='min-w-fit text-gray-900 dark:text-gray-300 text-sm mt-4'>
          <Trans
            i18nKey='advancedConfig'
            ns='api'
            components={[
              <a
                className='link cursor-pointer'
                onClick={() => {
                  setIsModalOpen(false);
                  document.getElementById('api-menu')?.click();
                }}
              />,
            ]}
          />
        </div>

        <div className='min-w-fit text-gray-900 dark:text-gray-300 text-sm mt-4'>
          {t('securityMessage', { ns: 'api' })}
        </div>

        {error.length > 0 && (
          <div className='relative py-2 px-3 w-full mt-3 border rounded-md border-red-500 bg-red-500/10'>
            <div className='text-gray-600 dark:text-gray-100 text-sm whitespace-pre-wrap'>
              {error}
            </div>
            <div
              className='text-white absolute top-1 right-1 cursor-pointer'
              onClick={() => {
                setError('');
              }}
            >
              <CrossIcon />
            </div>
          </div>
        )}
      </div>
    </PopupModal>
  ) : (
    <></>
  );
};

export default ApiPopup;
