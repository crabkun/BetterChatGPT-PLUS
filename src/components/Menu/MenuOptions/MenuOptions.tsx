import React from 'react';
import useStore from '@store/store';

import Api from './Api';
import Me from './Me';
import AboutMenu from '@components/AboutMenu';
import ImportExportChat from '@components/ImportExportChat';
import GoogleDriveSync from '@components/GoogleDriveSync';
import SettingsMenu from '@components/SettingsMenu';
import CollapseOptions from './CollapseOptions';
import { TotalTokenCostDisplay } from '@components/SettingsMenu/TotalTokenCost';

const MenuOptions = () => {
  const hideMenuOptions = useStore((state) => state.hideMenuOptions);
  const countTotalTokens = useStore((state) => state.countTotalTokens);
  return (
    <>
      <CollapseOptions />
      <div
        className={`${hideMenuOptions ? 'max-h-0' : 'max-h-full'
          } overflow-hidden transition-all`}
      >
        {countTotalTokens && <TotalTokenCostDisplay />}
        <AboutMenu />
        <ImportExportChat />
        <GoogleDriveSync />
        <Api />
        <SettingsMenu />
        <Me />
      </div>
    </>
  );
};

export default MenuOptions;
