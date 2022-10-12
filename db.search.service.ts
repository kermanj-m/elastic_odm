import { Injectable } from "@nestjs/common";
import { ElasticsearchService } from '@nestjs/elasticsearch';
import * as datamodel from "./db.datamodel";

@Injectable()
export class SearchDBService
{
    constructor(private elsService:ElasticsearchService) {}

    async fetch(data:datamodel.SearchData)
    {
        let response, queryString;
        if(data.scrollId) {
            queryString = {
                scroll: data.windowTimeSize,
                scroll_id: data.scrollId,
            };
            console.log("Search QueryString: "+JSON.stringify(queryString)+"\n");
            response = await this.elsService.scroll(queryString);
        }
        else {
            queryString = {
                index: data.indexname,
                from: data.offset,
                size: data.size,
                body: {
                    query: { 
                        "match_all": {} 
                    }
                },
                sort: data.sortField
            }
            queryString['scroll'] = data.windowTimeSize;
            console.log("QueryString: "+JSON.stringify(queryString)+"\n");
            response = await this.elsService.search(queryString);
        }
        return  {count:response.body.hits.total.value, data:response.body.hits.hits, scroll_id:response.body._scroll_id};
    }

    async search(data:datamodel.SearchData)
    { 
        let queryString = this.query_constructor(data)
        console.log("QueryString: "+JSON.stringify(queryString)+"\n");
        let response = await this.elsService.search(queryString);
        this.post_process(response);
        return  {count:response.body.hits.total.value, data:response.body.hits.hits};
    }

    async scroll_search(data:datamodel.SearchData)
    {
        let queryString, response
        if(data.scrollId) {
                queryString = {
                scroll: data.windowTimeSize,
                scroll_id: data.scrollId,
            };
            console.log("Search QueryString: "+JSON.stringify(queryString)+"\n");
            response = await this.elsService.scroll(queryString);
        }
        else {
            queryString = this.query_constructor(data);
            queryString['scroll'] = data.windowTimeSize;
            console.log("QueryString: "+JSON.stringify(queryString)+"\n");
            response = await this.elsService.search(queryString);
        }
        return  {count:response.body.hits.total.value, data:response.body.hits.hits, scroll_id:response.body._scroll_id};
    }

    async search_doc_byid(indexname:string,docId:string,limitedFields=[])
    {
        var querystring = { 
            index:indexname,
            id: docId
        };
        if(limitedFields.length>0) {
            querystring['body'] = {}
            querystring['body']['fields'] = limitedFields;
            querystring['body']['_source'] = false;
        }
        let response = await this.elsService.get(querystring);
        return response;
        //Response id => body : {_index:... , _id:... , ... ,_source:{}}
    }

    async count(data:datamodel.SearchData)
    { 
        let queryString = this.query_constructor(data);
        delete queryString.from;
        delete queryString.size;
        delete queryString.body.sort;
        delete queryString.body.highlight;
        console.log("Count QueryString: "+JSON.stringify(queryString)+"\n");
        
        let response = await this.elsService.count(queryString);
        if(response.body.count)
            return response.body.count;
        else 
            return 0;
    }
    
    query_constructor(data:datamodel.SearchData)
    {
        let querystring = {
            index: data.indexname,
            from: data.offset,
            size: data.size,
            body: {
                query: {
                    bool: {
                        "must": [],
                        "should": [],
                        "must_not": [],
                        "filter": []
                    }
                },
                "highlight": {
                    "fields": {}
                },
                'sort': {} //timeField : {'order':orderType} 
            }
        }
        //user_key filter
        let gfId = 0;
        if(data.gFilter) {
            querystring.body.query.bool.filter[gfId] = {};
            querystring.body.query.bool.filter[gfId]['multi_match'] = {}
            querystring.body.query.bool.filter[gfId]['multi_match']['type'] = "best_fields";
            querystring.body.query.bool.filter[gfId]['multi_match']['query'] = data.gFilter;
            querystring.body.query.bool.filter[gfId]['multi_match']['lenient'] = 'true';
            gfId++;
        }
        //Set Time for query
        if(data.begintime) {
            querystring.body.query.bool.filter[gfId] = {};
            querystring.body.query.bool.filter[gfId]['range'] = {};
            querystring.body.query.bool.filter[gfId]['range'][data.timeField] = {};
            //querystring.body.query.bool.filter[gfId]['range']['date']['format'] = timeFormat;
            querystring.body.query.bool.filter[gfId]['range'][data.timeField]['gt'] = data.begintime;
            if(data.endtime) 
                querystring.body.query.bool.filter[gfId]['range'][data.timeField]['lte'] = data.endtime;
        }

        //And Filter
        if (data.andFilter) {
            for(let i=0; i<data.andFilter.length; i++) {
                querystring.body.query.bool.must[i] = {}
                switch(data.andFilter[i].type) {
                    case 'range'://if(andFilter[i].type==='range') {
                        querystring.body.query.bool.must[i]['range'] = {};
                        if(typeof(data.andFilter[i].fieldvalue.gt) !== 'undefined')
                            querystring.body.query.bool.must[i]['range'][data.andFilter[i].fieldname] = {gt:data.andFilter[i].fieldvalue.gt}; //,lt:andFilter[i].value.lt};
                        else if(typeof(data.andFilter[i].fieldvalue.gte) !== 'undefined')
                            querystring.body.query.bool.must[i]['range'][data.andFilter[i].fieldname] = {gte:data.andFilter[i].fieldvalue.gte}; //,lt:andFilter[i].value.lt};
                        if(typeof(data.andFilter[i].fieldvalue.lt) !== 'undefined')
                            querystring.body.query.bool.must[i]['range'][data.andFilter[i].fieldname]['lt'] = data.andFilter[i].fieldvalue.lt;
                        else if(typeof(data.andFilter[i].fieldvalue.lte) !== 'undefined')
                            querystring.body.query.bool.must[i]['range'][data.andFilter[i].fieldname]['lte'] = data.andFilter[i].fieldvalue.lte;
                        break;
                    case 'normal':
                        if( (typeof(data.andFilter[i].fieldvalue)!=='string') && ( (data.andFilter[i].fieldvalue).length>1) ) {
                            querystring.body.query.bool.must[i]['terms'] = {}; 
                            querystring.body.query.bool.must[i]['terms'][data.andFilter[i].fieldname] = data.andFilter[i].fieldvalue;
                        }
                        else {
                            querystring.body.query.bool.must[i]['term'] = {};
                            querystring.body.query.bool.must[i]['term'][data.andFilter[i].fieldname] = data.andFilter[i].fieldvalue;
                        }
                        break;
                    case 'wildcard':
                        querystring.body.query.bool.must[i]['wildcard'] = {}  
                        querystring.body.query.bool.must[i]['wildcard'][data.andFilter[i].fieldname] = {};
                        querystring.body.query.bool.must[i]['wildcard'][data.andFilter[i].fieldname]['value'] = data.andFilter[0].fieldvalue;
                        break;
                    case 'text':
                        querystring.body.query.bool.must[i]['match'] = {};
                        querystring.body.query.bool.must[i]['match'][data.andFilter[i].fieldname] = data.andFilter[i].fieldvalue;
                        break;
                }
            }
        }
        
        //Not Filter
        if (data.notFilter) {
            for(let i=0; i<data.notFilter.length; i++) {
                querystring.body.query.bool.must_not[i] = {}
                switch(data.notFilter[i].type) {
                    case 'range':
                        querystring.body.query.bool.must_not[i]['range'] = {};
                        if(typeof(data.notFilter[i].fieldvalue.gt) !== 'undefined')
                            querystring.body.query.bool.must_not[i]['range'][data.notFilter[i].fieldname] = {gt:data.notFilter[i].fieldvalue.gt}; //,lt:andFilter[i].value.lt};
                        else if(typeof(data.notFilter[i].fieldvalue.gte) !== 'undefined')
                            querystring.body.query.bool.must_not[i]['range'][data.notFilter[i].fieldname] = {gte:data.notFilter[i].fieldvalue.gte}; //,lt:andFilter[i].value.lt};
                        if(typeof(data.notFilter[i].fieldvalue.lt) !== 'undefined')
                            querystring.body.query.bool.must_not[i]['range'][data.notFilter[i].fieldname]['lt'] = data.notFilter[i].fieldvalue.lt;
                        else if(typeof(data.notFilter[i].fieldvalue.lte) !== 'undefined')
                            querystring.body.query.bool.must_not[i]['range'][data.notFilter[i].fieldname]['lte'] = data.notFilter[i].fieldvalue.lte;
                        break;
                    case 'normal':
                        if( (typeof(data.notFilter[i].fieldvalue)!=='string') && ( (data.notFilter[i].fieldvalue).length>1) ) {
                            querystring.body.query.bool.must_not[i]['terms'] = {}; 
                            querystring.body.query.bool.must_not[i]['terms'][data.notFilter[i].fieldname] = data.notFilter[i].fieldvalue;
                        }
                        else {
                            querystring.body.query.bool.must_not[i]['term'] = {};
                            querystring.body.query.bool.must_not[i]['term'][data.notFilter[i].fieldname] = data.notFilter[i].fieldvalue;
                        }
                        break;
                    case 'wildcard':
                        querystring.body.query.bool.must_not[i]['wildcard'] = {}  
                        querystring.body.query.bool.must_not[i]['wildcard'][data.notFilter[i].fieldname] = {};
                        querystring.body.query.bool.must_not[i]['wildcard'][data.notFilter[i].fieldname]['value'] = data.notFilter[0].fieldvalue;
                        break;
                    case 'text':
                        querystring.body.query.bool.must_not[i]['match'] = {};
                        querystring.body.query.bool.must_not[i]['match'][data.notFilter[i].fieldname] = data.notFilter[i].fieldvalue;
                        break;
                }
            }
        }

        //Set Sort
        if (data.sortField) {
            querystring.body['sort'] = {};
            querystring.body['sort'][data.sortField] = {}
            querystring.body['sort'][data.sortField]['order'] = 'desc';
        }

        //Highlighting
        if(data.highlight) {
            for (let i in data.highlight)
                querystring.body.highlight.fields[data.highlight[i]]= {};
        }
        else 
            delete querystring.body.highlight;
        
        return querystring;
    }

    async post_process(data)
    {
        for (let i=0; i<(data.body.hits.hits).length; i++) {
            delete data.body.hits.hits[i]['_index'];
            delete data.body.hits.hits[i]['_type'];
            delete data.body.hits.hits[i]['_score'];
        }
    }
}