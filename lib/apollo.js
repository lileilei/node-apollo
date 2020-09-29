'use strict';

const urllib = require('urllib');
const assert = require('assert');
const fs = require('fs');
const helper = require('./helper');
const config = require('../config.js');

let configCache = {
    times: 60000
}
let configurations = {}
let cls = {
    // Apollo开放平台接入方式
    remoteConfigService: async (config) => {
        assert(config, 'param config is required');
        assert(config.token, 'param token is required');
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                authorization: config.token,
            },
            rejectUnauthorized: true,
            contentType: 'json',
            dataType: 'json',
        };
        const res = await urllib.request(helper.getAllConfigFromApolloUri(config), options);
        assert(res.status === 200, 'apollo host unavailable, please contact your administrtor');
        return helper.mergeConfig(res.data);
    },

    // 通过不带缓存的Http接口从Apollo读取配置
    remoteConfigServiceSkipCache: async (config) => {
        assert(config, 'param config is required');
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            },
            rejectUnauthorized: true,
            contentType: 'json',
            dataType: 'json',
        };
        const URIs = helper.getConfigSkipCacheUri(config);
        const bundle = await Promise.all(URIs.map(uri => urllib.request(uri, options)));
        for (let res of bundle) {
            assert(res.status === 200, 'apollo host unavailable, please contact your administrtor');
        }
        return helper.mergeConfigurations(bundle);
    },
    //自检测是否更改
    remoteConfigLongPollService: async (config) => {
        assert(config, 'param config is required');
        Object.assign(configCache, config)
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            },
            rejectUnauthorized: true,
            contentType: 'json',
            dataType: 'json',
        };
        const URIs = helper.getConfigSkipCacheUri(config);
        try {
            const bundle = await Promise.all(URIs.map(uri => urllib.request(uri, options)));
            for (let res of bundle) {
                if (res.status === 304) {
                    throw new Error('apollo暂无更新!')
                }
                configCache["releaseKey"] = res.data.releaseKey
            }
            configurations = helper.mergeConfigurations(bundle);
        } catch (e) {
            // console.info(e.message)
        }
        setTimeout(() => {
            cls.remoteConfigLongPollService(configCache)
        }, configCache.times)
        return cls
    },
    //通过key获取apollo配置项的value
    getValue: (key) => {
        if (key) {
            return configurations[key]
        }
        return configurations
    },
    // 向后兼容
    remoteConfigServiceSikpCache: async (config) => {
        assert(config, 'param config is required');
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            },
            rejectUnauthorized: true,
            contentType: 'json',
            dataType: 'json',
        };
        const URIs = helper.getConfigSkipCacheUri(config);
        const bundle = await Promise.all(URIs.map(uri => urllib.request(uri, options)));
        for (let res of bundle) {
            assert(res.status === 200, 'apollo host unavailable, please contact your administrtor');
        }
        return helper.mergeConfigurations(bundle);
    },


    //通过带缓存的Http接口从Apollo读取配置
    remoteConfigServiceFromCache: async (config) => {
        assert(config, 'param config is required');
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            },
            rejectUnauthorized: true,
            contentType: 'json',
            dataType: 'json',
        };
        const URIs = helper.getConfigFromCacheUri(config);
        const bundle = await Promise.all(URIs.map(uri => urllib.request(uri, options)));
        for (let res of bundle) {
            assert(res.status === 200, 'apollo host unavailable, please contact your administrtor');
        }
        return helper.mergeConfigurations(bundle);
    },

    // 生成default.env
    createEnvFile: (envConfig) => {
        if (fs.existsSync(config.ENV_FILE_PATH)) {
            fs.unlinkSync(config.ENV_FILE_PATH);
        }
        for (let key of Object.keys(envConfig)) {
            fs.appendFileSync(config.ENV_FILE_PATH, `${key}=${envConfig[key]}\n`);
        }
    },

    // 注入到process.env
    setEnv: () => {
        try {
            require('dotenv').config({path: config.ENV_FILE_PATH});
        } catch (err) {
            assert(false, err);
        }
    }
};
module.exports = cls
