import { refresh } from "./navigation";

export const revalidatePath = (...path: [string, string?]) => {
  if (path[0] !== "/") throw new Error("The demo refreshes the whole page");
  refresh();
};
