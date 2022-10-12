export class SearchData {
    indexname:string[];
    gFilter:string;
    andFilter:{type:string,fieldname:string,fieldvalue:any}[] 
    notFilter:{type:string,fieldname:string,fieldvalue:any}[]
    begintime:string|number;
    endtime:string|number;
    timeField: string;
    sortField: string;
    size:number; //Must not bigger than 10000
    offset:number;
    highlight:string[];
    scrollId: string;
    windowTimeSize: string;
    
    constructor()
    {
        this.indexname = ["_all"];
        this.gFilter = null;
        this.andFilter = null; //{type:"string",fieldname:"string","fieldvalue"}
        this.notFilter = null;
        this.begintime = null;
        this.endtime = null;
        this.timeField = null;
        this.sortField = "_doc";
        this.size = 10;
        this.offset = 0;
        this.highlight = null;
        this.scrollId = null;
        this.windowTimeSize = "5s";
    }
}