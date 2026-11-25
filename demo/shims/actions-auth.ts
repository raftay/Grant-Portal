import * as real from "../../src/app/actions/auth";
import { act } from "./act";

export const passwordSignIn = act(real.passwordSignIn);
export const linkSignIn = act(real.linkSignIn);
export const askForReset = act(real.askForReset);
export const chooseNewPassword = act(real.chooseNewPassword);
export const joinWorkspace = act(real.joinWorkspace);

export const leave = async (): Promise<void> => {
  await act(async () => {
    await real.leave();
    return { status: "idle" };
  })();
};
