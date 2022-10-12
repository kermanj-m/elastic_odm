import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { SearchDBService } from './db.search.service';
import { DbAggService } from './db.agg.service';

@Module({
    imports: [
        ElasticsearchModule.register({
            node: process.env.address, //"https://elasticsearch.com:9200,
            maxRetries: Number(process.env.max_retries) || 3,
            requestTimeout: Number(process.env.request_timeout) || 30000,
            auth: {
                username: process.env.username || usernam,
                password: process.env.password  || password
            },
            ssl: {
                //ca: CA File 
                rejectUnauthorized: true, //If no ssl ca, set it's value to false
            }
        })
    ],
    providers: [
        SearchDBService,
        DbAggService,
    ],
    exports: [
        SearchDBService,
        DbAggService,
    ]
})
export class EldbModule {}
