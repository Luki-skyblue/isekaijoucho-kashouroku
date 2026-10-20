import 'server-only';
import {createOwnerGateway} from '@/lib/catalog-owner-gateway.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const handle=createOwnerGateway();
export const POST=handle;
export const GET=handle;
export const HEAD=handle;
export const PUT=handle;
export const PATCH=handle;
export const DELETE=handle;
export const OPTIONS=handle;
