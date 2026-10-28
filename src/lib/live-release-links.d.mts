import type {PrivateModel} from './private-read-model.mjs';
export type RecordedEventLink={eventId:string;occurrenceId:string|null;title:string;href:string};
export type EventRecordingLink={familyId:string;editionId:string|null;title:string;href:string};
export function recordedEventsForRelease(model:PrivateModel,familyId:string,query?:{editionId?:string|null}):RecordedEventLink[];
export function recordingsForEvent(model:PrivateModel,eventId:string):EventRecordingLink[];
