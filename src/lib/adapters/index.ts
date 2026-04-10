import { DistributorAdapter } from "./adapter.interface";
import { MouserAdapter }      from "./mouser.adapter";
import { DigikeyAdapter }     from "./digikey.adapter";
import {
  MockMouserAdapter,
  MockDigikeyAdapter,
  MockFarnellAdapter,
} from "./mock.adapter";

const USE_MOCK =
  process.env.NEXT_PUBLIC_USE_MOCK === "true" ||
  !process.env.MOUSER_API_KEY      ||
  process.env.MOUSER_API_KEY       === "placeholder";

export const distributors: DistributorAdapter[] = USE_MOCK
  ? [MockMouserAdapter, MockDigikeyAdapter, MockFarnellAdapter]
  : [MouserAdapter, DigikeyAdapter];
