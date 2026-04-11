import type { UserAccount } from "./appData";

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  DoctorWorkspace: { user: UserAccount };
  PatientCompanion: { user: UserAccount };
};
