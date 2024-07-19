import React, { useContext, useState } from "react";
import { useQuery } from "react-query";
import { InjectedRouter } from "react-router";
import { AxiosError } from "axios";

import PATHS from "router/paths";
import mdmAppleAPI, {
  IGetVppInfoResponse,
  IVppApp,
} from "services/entities/mdm_apple";
import { DEFAULT_USE_QUERY_OPTIONS } from "utilities/constants";

import Card from "components/Card";
import CustomLink from "components/CustomLink";
import Spinner from "components/Spinner";
import Button from "components/buttons/Button";
import DataError from "components/DataError";
import Radio from "components/forms/fields/Radio";
import { NotificationContext } from "context/notification";
import { getErrorReason } from "interfaces/errors";
import { buildQueryStringFromParams } from "utilities/url";
import SoftwareIcon from "../icons/SoftwareIcon";

const baseClass = "app-store-vpp";

const EnableVppCard = () => {
  return (
    <Card borderRadiusSize="medium">
      <div className={`${baseClass}__enable-vpp`}>
        <p className={`${baseClass}__enable-vpp-title`}>
          <b>Volume Purchasing Program (VPP) isn’t enabled.</b>
        </p>
        <p className={`${baseClass}__enable-vpp-description`}>
          To add App Store apps, first enable VPP.
        </p>
        <CustomLink
          url={PATHS.ADMIN_INTEGRATIONS_VPP}
          text="Enable VPP"
          className={`${baseClass}__enable-vpp-link`}
        />
      </div>
    </Card>
  );
};

interface IVppAppListItemProps {
  app: IVppApp;
  selected: boolean;
  onSelect: (software: IVppApp) => void;
}

const VppAppListItem = ({ app, selected, onSelect }: IVppAppListItemProps) => {
  return (
    <li className={`${baseClass}__list-item`}>
      <Radio
        label={
          <div className={`${baseClass}__app-info`}>
            <SoftwareIcon url={app.icon_url} />
            <span>{app.name}</span>
          </div>
        }
        id={`vppApp-${app.app_store_id}`}
        checked={selected}
        value={app.app_store_id.toString()}
        name="vppApp"
        onChange={() => onSelect(app)}
      />
    </li>
  );
};

interface IVppAppListProps {
  apps: IVppApp[];
  selectedApp: IVppApp | null;
  onSelect: (app: IVppApp) => void;
}

const VppAppList = ({ apps, selectedApp, onSelect }: IVppAppListProps) => {
  const renderContent = () => {
    if (apps.length === 0) {
      return (
        <div className={`${baseClass}__no-software`}>
          <p className={`${baseClass}__no-software-title`}>
            You don&apos;t have any App Store apps
          </p>
          <p className={`${baseClass}__no-software-description`}>
            You must purchase apps in ABM. App Store apps that are already added
            to this team are not listed.
          </p>
        </div>
      );
    }

    return (
      <ul className={`${baseClass}__list`}>
        {apps.map((app) => (
          <VppAppListItem
            key={app.app_store_id}
            app={app}
            selected={selectedApp?.app_store_id === app.app_store_id}
            onSelect={onSelect}
          />
        ))}
      </ul>
    );
  };

  return (
    <div className={`${baseClass}__list-container`}>{renderContent()}</div>
  );
};

interface IAppStoreVppProps {
  teamId: number;
  router: InjectedRouter;
  onExit: () => void;
}

const AppStoreVpp = ({ teamId, router, onExit }: IAppStoreVppProps) => {
  const { renderFlash } = useContext(NotificationContext);
  const [isSubmitDisabled, setIsSubmitDisabled] = useState(true);
  const [selectedApp, setSelectedApp] = useState<IVppApp | null>(null);

  const {
    data: vppInfo,
    isLoading: isLoadingVppInfo,
    error: errorVppInfo,
  } = useQuery<IGetVppInfoResponse, AxiosError>(
    ["vppInfo"],
    () => mdmAppleAPI.getVppInfo(),
    {
      ...DEFAULT_USE_QUERY_OPTIONS,
      staleTime: 30000,
      retry: (tries, error) => error.status !== 404 && tries <= 3,
    }
  );

  const {
    data: vppApps,
    isLoading: isLoadingVppApps,
    error: errorVppApps,
  } = useQuery(["vppSoftware", teamId], () => mdmAppleAPI.getVppApps(teamId), {
    ...DEFAULT_USE_QUERY_OPTIONS,
    enabled: !!vppInfo,
    staleTime: 30000,
    select: (res) => res.app_store_apps,
  });

  const onSelectApp = (app: IVppApp) => {
    setIsSubmitDisabled(false);
    setSelectedApp(app);
  };

  const onAddSoftware = async () => {
    if (!selectedApp) {
      return;
    }

    try {
      await mdmAppleAPI.addVppApp(teamId, selectedApp.app_store_id);
      renderFlash(
        "success",
        <>
          <b>{selectedApp.name}</b> successfully added. Go to Host details page
          to install software.
        </>
      );
      const queryParams = buildQueryStringFromParams({
        team_id: teamId,
        available_for_install: true,
      });
      router.push(`${PATHS.SOFTWARE}?${queryParams}`);
    } catch (e) {
      const reason = getErrorReason(e);
      // TODO: update with pre-defined error messages we want to pass through from the API
      if (reason.toLowerCase().includes("already")) {
        renderFlash("error", reason);
      } else {
        renderFlash("error", "Couldn’t add software. Please try again.");
      }
    }
    onExit();
  };

  const renderContent = () => {
    if (isLoadingVppInfo || isLoadingVppApps) {
      return <Spinner />;
    }

    if (
      errorVppInfo &&
      getErrorReason(errorVppInfo).includes("MDMConfigAsset was not found")
    ) {
      return <EnableVppCard />;
    }

    if (errorVppInfo || errorVppApps) {
      return <DataError className={`${baseClass}__error`} />;
    }

    return vppApps ? (
      <VppAppList
        apps={vppApps}
        selectedApp={selectedApp}
        onSelect={onSelectApp}
      />
    ) : null;
  };

  return (
    <div className={baseClass}>
      <p className={`${baseClass}__description`}>
        Apple App Store apps purchased via Apple Business Manager.
      </p>
      {renderContent()}
      <div className="modal-cta-wrap">
        <Button
          type="submit"
          variant="brand"
          disabled={isSubmitDisabled}
          onClick={onAddSoftware}
        >
          Add software
        </Button>
        <Button onClick={onExit} variant="inverse">
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default AppStoreVpp;
