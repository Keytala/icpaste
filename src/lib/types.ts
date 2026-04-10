typescript

export interface PriceTier {

qty:   number;

price: number;

}



export interface PartResult {

distributor: string;

mpn:         string;

description: string;

stock:       number;

packageUnit: number;

priceTiers:  PriceTier[];

productUrl:  string;

currency:    string;

}



export interface BomRow {

mpn: string;

qty: number;

}



export interface ResultRow {

mpn:         string;

requestedQty: number;

optimalQty:  number;

unitPrice:   number;

totalPrice:  number;

currency:    string;

distributor: string;

stock:       number;

productUrl:  string;

description: string;
adjustment:  "none" | "package" | "pricestep" | "both";
saved:       number;

error?:      string;

}



export interface SearchResponse {

results:    ResultRow[];

totalBom:   number;

searchedAt: string;

}
