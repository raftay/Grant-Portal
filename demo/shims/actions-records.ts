import * as real from "../../src/app/actions/records";
import { act } from "./act";

export const saveProfile = act(real.saveProfile);
export const addGrant = act(real.addGrant);
export const editGrant = act(real.editGrant);
export const saveContact = act(real.saveContact);
export const deleteContact = act(real.deleteContact);
export const saveLink = act(real.saveLink);
export const deleteLink = act(real.deleteLink);
export const saveDeadline = act(real.saveDeadline);
export const saveDocument = act(real.saveDocument);
export const retireDocument = act(real.retireDocument);
export const invite = act(real.invite);
export const reinvite = act(real.reinvite);
export const setRole = act(real.setRole);
export const setPayroll = act(real.setPayroll);
export const setActive = act(real.setActive);
export const runAlerts = act(real.runAlerts);
