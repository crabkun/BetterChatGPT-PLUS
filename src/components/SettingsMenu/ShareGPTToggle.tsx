import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useStore from '@store/store';
import Toggle from '@components/Toggle';

const ShareGPTToggle = () => {
  const { t } = useTranslation();
  const setShareGPTEnabled = useStore((state) => state.setShareGPTEnabled);
  const [isChecked, setIsChecked] = useState<boolean>(
    useStore.getState().shareGPTEnabled
  );

  useEffect(() => {
    setShareGPTEnabled(isChecked);
  }, [isChecked]);

  return (
    <Toggle
      label={t('enableShareGPT') as string}
      isChecked={isChecked}
      setIsChecked={setIsChecked}
    />
  );
};

export default ShareGPTToggle;
