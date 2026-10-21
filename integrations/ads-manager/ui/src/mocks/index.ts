import { MockCampaigns } from './Campaigns';
import { MockDashboard } from './Dashboard';
import { MockGnuboardRequests } from './GnuboardRequests';
import { MockApprovals, MockGnuboardSettings, MockNewLineItem, MockReportV2, MockSettings } from './Unimplemented';

/** Static mock screens with no API calls; every write button is disabled. */
export const mockScreens = {
  standalone: {
    dashboard: MockDashboard,
    campaigns: MockCampaigns,
    approvals: MockApprovals,
    reportV2: MockReportV2,
    settings: MockSettings,
    newLineItem: MockNewLineItem,
  },
  gnuboard: {
    requests: MockGnuboardRequests,
    settings: MockGnuboardSettings,
  },
};
