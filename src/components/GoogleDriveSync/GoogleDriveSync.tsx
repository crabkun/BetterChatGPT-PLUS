import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

import useStore from '@store/store';
import PopupModal from '@components/PopupModal';
import GoogleDriveIcon from '@icon/GoogleDriveIcon';
import SpinnerIcon from '@icon/SpinnerIcon';
import useInitialiseNewChat from '@hooks/useInitialiseNewChat';

import { uploadToGoogleDrive, downloadFromGoogleDrive } from '@utils/googleDrive';
import Export from '@type/export';

const GoogleDriveSync = () => {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const googleClientId = useStore((state) => state.googleClientId);
    const setGoogleClientId = useStore((state) => state.setGoogleClientId);
    const [_clientId, _setClientId] = useState(googleClientId);

    const setChats = useStore((state) => state.setChats);
    const setFolders = useStore((state) => state.setFolders);
    const initialiseNewChat = useInitialiseNewChat();

    const handleOpenModal = () => {
        _setClientId(googleClientId);
        setIsModalOpen(true);
    };

    const saveClientId = () => {
        if (_clientId !== googleClientId) {
            setGoogleClientId(_clientId.trim());
        }
    };

    /* ---- Sync TO cloud ---- */
    const handleSyncToCloud = async () => {
        saveClientId();
        const id = _clientId.trim();
        if (!id) {
            toast.error(t('googleDriveSync.clientIdRequired') as string);
            return;
        }

        // Confirmation dialog
        if (!window.confirm(t('googleDriveSync.syncToCloudWarning') as string)) {
            return;
        }

        setIsSyncing(true);
        try {
            const fileData: Export = {
                chats: useStore.getState().chats,
                folders: useStore.getState().folders,
                version: 1,
            };
            await uploadToGoogleDrive(id, fileData);
            toast.success(t('googleDriveSync.syncToCloudSuccess') as string);
        } catch (err: any) {
            console.error('Sync to cloud failed', err);
            toast.error(
                `${t('googleDriveSync.syncToCloudError')}: ${err.message}`,
                { autoClose: 10000 }
            );
        } finally {
            setIsSyncing(false);
        }
    };

    /* ---- Sync FROM cloud ---- */
    const handleSyncFromCloud = async () => {
        saveClientId();
        const id = _clientId.trim();
        if (!id) {
            toast.error(t('googleDriveSync.clientIdRequired') as string);
            return;
        }

        // Confirmation dialog
        if (!window.confirm(t('googleDriveSync.syncFromCloudWarning') as string)) {
            return;
        }

        setIsSyncing(true);
        try {
            const data = await downloadFromGoogleDrive(id);
            if (!data) {
                toast.warning(t('googleDriveSync.noFileFound') as string);
                return;
            }

            const imported = data as Export;

            // Clear local then import cloud data
            initialiseNewChat();
            setFolders(imported.folders ?? {});
            if (imported.chats) {
                setChats(imported.chats);
            }

            toast.success(t('googleDriveSync.syncFromCloudSuccess') as string);
            setIsModalOpen(false);
        } catch (err: any) {
            console.error('Sync from cloud failed', err);
            toast.error(
                `${t('googleDriveSync.syncFromCloudError')}: ${err.message}`,
                { autoClose: 10000 }
            );
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <>
            <a
                className='flex py-2 px-2 items-center gap-3 rounded-md hover:bg-gray-500/10 transition-colors duration-200 text-white cursor-pointer text-sm'
                onClick={handleOpenModal}
                id='google-drive-sync-btn'
            >
                <GoogleDriveIcon className='w-4 h-4' />
                {t('googleDriveSync.title')}
            </a>

            {isModalOpen && (
                <PopupModal
                    title={t('googleDriveSync.title') as string}
                    setIsModalOpen={setIsModalOpen}
                    cancelButton={!isSyncing}
                >
                    <div className='p-6 border-b border-gray-200 dark:border-gray-600'>
                        {/* Google Client ID Input */}
                        <div className='mb-4'>
                            <label className='block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300'>
                                {t('googleDriveSync.clientIdLabel')}
                            </label>
                            <input
                                type='text'
                                className='text-gray-800 dark:text-white p-3 text-sm border-none bg-gray-200 dark:bg-gray-600 rounded-md w-full h-8 focus:outline-none'
                                value={_clientId}
                                onChange={(e) => _setClientId(e.target.value)}
                                placeholder={t('googleDriveSync.clientIdPlaceholder') as string}
                                disabled={isSyncing}
                            />
                            <details className='mt-3 text-xs text-gray-500 dark:text-gray-400'>
                                <summary className='cursor-pointer font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white select-none'>
                                    {t('googleDriveSync.setupGuideTitle')}
                                </summary>
                                <ol className='mt-2 ml-4 space-y-1.5 list-decimal'>
                                    <li>{t('googleDriveSync.step1')}</li>
                                    <li>{t('googleDriveSync.step2')}</li>
                                    <li>{t('googleDriveSync.step3')}</li>
                                    <li>{t('googleDriveSync.step4')}</li>
                                    <li>{t('googleDriveSync.step5')}</li>
                                </ol>
                                <p className='mt-2 italic'>
                                    {t('googleDriveSync.clientIdLocalNote')}
                                </p>
                            </details>
                        </div>

                        {/* Sync buttons */}
                        <div className='flex flex-col gap-3'>
                            <button
                                className='btn btn-primary flex items-center justify-center gap-2'
                                onClick={handleSyncToCloud}
                                disabled={isSyncing}
                                aria-label={t('googleDriveSync.syncToCloud') as string}
                            >
                                {isSyncing ? (
                                    <SpinnerIcon className='animate-spin w-4 h-4' />
                                ) : (
                                    <GoogleDriveIcon className='w-4 h-4' />
                                )}
                                {isSyncing
                                    ? t('googleDriveSync.syncing')
                                    : t('googleDriveSync.syncToCloud')}
                            </button>

                            <button
                                className='btn btn-neutral flex items-center justify-center gap-2'
                                onClick={handleSyncFromCloud}
                                disabled={isSyncing}
                                aria-label={t('googleDriveSync.syncFromCloud') as string}
                            >
                                {isSyncing ? (
                                    <SpinnerIcon className='animate-spin w-4 h-4' />
                                ) : (
                                    <GoogleDriveIcon className='w-4 h-4' />
                                )}
                                {isSyncing
                                    ? t('googleDriveSync.syncing')
                                    : t('googleDriveSync.syncFromCloud')}
                            </button>
                        </div>

                        {/* Storage location hint */}
                        <p className='mt-4 text-xs text-gray-500 dark:text-gray-400'>
                            {t('googleDriveSync.storageLocationHint')}
                        </p>
                    </div>
                </PopupModal>
            )}
        </>
    );
};

export default GoogleDriveSync;
