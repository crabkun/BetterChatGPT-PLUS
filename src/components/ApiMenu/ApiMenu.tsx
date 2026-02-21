import React, { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import useStore from '@store/store';

import PopupModal from '@components/PopupModal';

import { defaultAPIBaseUrl } from '@constants/auth';
import { ApiProvider } from '@type/provider';

const providerOptions: { value: ApiProvider; labelKey: string }[] = [
  { value: 'openai', labelKey: 'provider.openai' },
  { value: 'gemini-aistudio', labelKey: 'provider.geminiAiStudio' },
  { value: 'gemini-vertexai', labelKey: 'provider.geminiVertexAi' },
];

const ApiMenu = ({
  setIsModalOpen,
}: {
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const { t } = useTranslation(['main', 'api']);

  const apiKey = useStore((state) => state.apiKey);
  const setApiKey = useStore((state) => state.setApiKey);
  const apiBaseUrl = useStore((state) => state.apiBaseUrl);
  const setApiBaseUrl = useStore((state) => state.setApiBaseUrl);
  const apiProvider = useStore((state) => state.apiProvider);
  const setApiProvider = useStore((state) => state.setApiProvider);
  const geminiApiKey = useStore((state) => state.geminiApiKey);
  const setGeminiApiKey = useStore((state) => state.setGeminiApiKey);
  const geminiVertexProjectId = useStore(
    (state) => state.geminiVertexProjectId
  );
  const setGeminiVertexProjectId = useStore(
    (state) => state.setGeminiVertexProjectId
  );
  const geminiVertexLocation = useStore(
    (state) => state.geminiVertexLocation
  );
  const setGeminiVertexLocation = useStore(
    (state) => state.setGeminiVertexLocation
  );

  const [_apiProvider, _setApiProvider] = useState<ApiProvider>(apiProvider);
  const [_apiKey, _setApiKey] = useState<string>(apiKey || '');
  const [_apiBaseUrl, _setApiBaseUrl] = useState<string>(apiBaseUrl);
  const [_geminiApiKey, _setGeminiApiKey] = useState<string>(geminiApiKey);
  const [_geminiVertexProjectId, _setGeminiVertexProjectId] =
    useState<string>(geminiVertexProjectId);
  const [_geminiVertexLocation, _setGeminiVertexLocation] =
    useState<string>(geminiVertexLocation);

  const handleSave = () => {
    setApiProvider(_apiProvider);
    setApiKey(_apiKey);
    setApiBaseUrl(_apiBaseUrl);
    setGeminiApiKey(_geminiApiKey);
    setGeminiVertexProjectId(_geminiVertexProjectId);
    setGeminiVertexLocation(_geminiVertexLocation);
    setIsModalOpen(false);
  };

  const isGemini =
    _apiProvider === 'gemini-aistudio' || _apiProvider === 'gemini-vertexai';

  return (
    <PopupModal
      title={t('api') as string}
      setIsModalOpen={setIsModalOpen}
      handleConfirm={handleSave}
    >
      <div className='p-6 border-b border-gray-200 dark:border-gray-600'>
        {/* Provider Selector */}
        <div className='flex gap-2 items-center mb-6'>
          <div className='min-w-fit text-gray-900 dark:text-gray-300 text-sm'>
            {t('provider.label', { ns: 'api' })}
          </div>
          <select
            className='text-gray-800 dark:text-white p-2 text-sm border-none bg-gray-200 dark:bg-gray-600 rounded-md m-0 w-full h-8 focus:outline-none'
            value={_apiProvider}
            onChange={(e) => _setApiProvider(e.target.value as ApiProvider)}
          >
            {providerOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey, { ns: 'api' })}
              </option>
            ))}
          </select>
        </div>

        {/* OpenAI Settings */}
        {_apiProvider === 'openai' && (
          <>
            <div className='flex gap-2 items-center mb-6'>
              <div className='min-w-fit text-gray-900 dark:text-gray-300 text-sm'>
                {t('apiBaseUrl.inputLabel', { ns: 'api' })}
              </div>
              <input
                type='text'
                className='text-gray-800 dark:text-white p-3 text-sm border-none bg-gray-200 dark:bg-gray-600 rounded-md m-0 w-full mr-0 h-8 focus:outline-none'
                value={_apiBaseUrl}
                onChange={(e) => _setApiBaseUrl(e.target.value)}
              />
            </div>

            <div className='flex gap-2 items-center justify-center mt-2'>
              <div className='min-w-fit text-gray-900 dark:text-gray-300 text-sm'>
                {t('apiKey.inputLabel', { ns: 'api' })}
              </div>
              <input
                type='text'
                className='text-gray-800 dark:text-white p-3 text-sm border-none bg-gray-200 dark:bg-gray-600 rounded-md m-0 w-full mr-0 h-8 focus:outline-none'
                value={_apiKey}
                onChange={(e) => _setApiKey(e.target.value)}
              />
            </div>

            <div className='min-w-fit text-gray-900 dark:text-gray-300 text-sm flex flex-col gap-3 leading-relaxed'>
              <p className='mt-4'>
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
              </p>
              <p>{t('securityMessage', { ns: 'api' })}</p>
              <p>{t('apiBaseUrl.description', { ns: 'api' })}</p>
              <p>{t('apiBaseUrl.warn', { ns: 'api' })}</p>
            </div>
          </>
        )}

        {/* Gemini AI Studio Settings */}
        {_apiProvider === 'gemini-aistudio' && (
          <>
            <div className='flex gap-2 items-center justify-center mt-2'>
              <div className='min-w-fit text-gray-900 dark:text-gray-300 text-sm'>
                {t('gemini.apiKeyLabel', { ns: 'api' })}
              </div>
              <input
                type='text'
                className='text-gray-800 dark:text-white p-3 text-sm border-none bg-gray-200 dark:bg-gray-600 rounded-md m-0 w-full mr-0 h-8 focus:outline-none'
                value={_geminiApiKey}
                onChange={(e) => _setGeminiApiKey(e.target.value)}
              />
            </div>

            <div className='min-w-fit text-gray-900 dark:text-gray-300 text-sm flex flex-col gap-3 leading-relaxed'>
              <p className='mt-4'>
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
              </p>
              <p>{t('securityMessage', { ns: 'api' })}</p>
            </div>
          </>
        )}

        {/* Gemini Vertex AI Settings */}
        {_apiProvider === 'gemini-vertexai' && (
          <>
            <div className='flex gap-2 items-center mb-4'>
              <div className='min-w-fit text-gray-900 dark:text-gray-300 text-sm'>
                {t('gemini.apiKeyLabel', { ns: 'api' })}
              </div>
              <input
                type='text'
                className='text-gray-800 dark:text-white p-3 text-sm border-none bg-gray-200 dark:bg-gray-600 rounded-md m-0 w-full mr-0 h-8 focus:outline-none'
                value={_geminiApiKey}
                onChange={(e) => _setGeminiApiKey(e.target.value)}
              />
            </div>
            <div className='flex gap-2 items-center mb-4'>
              <div className='min-w-fit text-gray-900 dark:text-gray-300 text-sm'>
                {t('gemini.projectIdLabel', { ns: 'api' })}
              </div>
              <input
                type='text'
                className='text-gray-800 dark:text-white p-3 text-sm border-none bg-gray-200 dark:bg-gray-600 rounded-md m-0 w-full mr-0 h-8 focus:outline-none'
                value={_geminiVertexProjectId}
                onChange={(e) => _setGeminiVertexProjectId(e.target.value)}
                placeholder='my-gcp-project'
              />
            </div>
            <div className='flex gap-2 items-center'>
              <div className='min-w-fit text-gray-900 dark:text-gray-300 text-sm'>
                {t('gemini.locationLabel', { ns: 'api' })}
              </div>
              <input
                type='text'
                className='text-gray-800 dark:text-white p-3 text-sm border-none bg-gray-200 dark:bg-gray-600 rounded-md m-0 w-full mr-0 h-8 focus:outline-none'
                value={_geminiVertexLocation}
                onChange={(e) => _setGeminiVertexLocation(e.target.value)}
                placeholder='us-central1'
              />
            </div>

            <div className='min-w-fit text-gray-900 dark:text-gray-300 text-sm flex flex-col gap-3 leading-relaxed'>
              <p className='mt-4'>
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
              </p>
              <p>{t('securityMessage', { ns: 'api' })}</p>
            </div>
          </>
        )}
      </div>
    </PopupModal>
  );
};

export default ApiMenu;
