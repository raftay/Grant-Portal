import * as real from "../../src/app/actions/files";
import { act } from "./act";

export type { DateSuggestions, Suggestion } from "../../src/app/actions/files";
export const { startUpload, finishUpload, suggestDates, replaceFile, addContract } = real;
export const addDocument = act(real.addDocument);
export const startContractReading = act(real.startContractReading);
export const confirmContractReading = act(real.confirmContractReading);
export const discardContractReading = act(real.discardContractReading);
