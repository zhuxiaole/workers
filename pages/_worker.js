export default {
    async fetch(request, _env) {
        return await handleRequest(request, _env);
    }
}

/**
 * Respond to the request
 * @param {Request} request
 */
async function handleRequest(request, env) {
    //请求头部、返回对象
    let reqHeaders = new Headers(request.headers),
        outBody, outStatus = 200, outStatusText = 'OK', outCt = null, outHeaders = new Headers({
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": reqHeaders.get('Access-Control-Allow-Headers') || "Accept, Authorization, Cache-Control, Content-Type, DNT, If-Modified-Since, Keep-Alive, Origin, User-Agent, X-Requested-With, Token, x-access-token"
        });

    try {
        const requestURL = new URL(request.url);

        // 如果访问根目录，返回默认页面
        if (requestURL.pathname === "/") {
            outBody = JSON.stringify({
                code: 0,
                usage: 'Host/{URL}',
                source: 'https://github.com/zhuxiaole/workers'
            });
            outCt = "application/json";
            outStatus = 200;
        } else {
            //取域名第一个斜杠后的所有信息为代理链接
            let actualUrl = requestURL.pathname + requestURL.search;
            actualUrl = decodeURIComponent(actualUrl.substring(actualUrl.indexOf('/') + 1));
            actualUrl = fixUrl(actualUrl);

            const actualURL = new URL(actualUrl);

            // 只允许白名单中的 host
            const whiteHostArr = await getWhiteHostArr(env);
            if (whiteHostArr.length > 0 && !whiteHostArr.includes(actualURL.host)) {
                outCt = "application/json";
                outBody = JSON.stringify({
                    code: -2,
                    msg: `非授权 host: ${actualURL.host}`
                });
                outStatus = 403;
            } else {
                //构建 fetch 参数
                let fp = {
                    method: request.method,
                    headers: {}
                }

                //保留头部其它信息
                const dropHeaders = ['content-length', 'content-type', 'host'];
                let he = reqHeaders.entries();
                for (let h of he) {
                    const key = h[0], value = h[1];
                    if (!dropHeaders.includes(key)) {
                        fp.headers[key] = value;
                    }
                }

                // 是否带 body
                if (["POST", "PUT", "PATCH", "DELETE"].indexOf(request.method) >= 0) {
                    const ct = (reqHeaders.get('content-type') || "").toLowerCase();
                    if (ct.includes('application/json')) {
                        fp.body = JSON.stringify(await request.json());
                    } else if (ct.includes('application/text') || ct.includes('text/html')) {
                        fp.body = await request.text();
                    } else if (ct.includes('form')) {
                        fp.body = await request.formData();
                    } else {
                        fp.body = await request.blob();
                    }
                }

                // 发起 fetch
                let fr = await fetch(actualUrl, fp);
                outCt = fr.headers.get('content-type');
                outStatus = fr.status;
                outStatusText = fr.statusText;
                outBody = fr.body;
            }
        }
    } catch (err) {
        outCt = "application/json";
        outBody = JSON.stringify({
            code: -1,
            msg: JSON.stringify(err.stack) || err
        });
        outStatus = 500;
    }

    //设置类型
    if (outCt && outCt != "") {
        outHeaders.set("content-type", outCt);
    }

    let response = new Response(outBody, {
        status: outStatus,
        statusText: outStatusText,
        headers: outHeaders
    })

    return response;
}

// 补齐 url
function fixUrl(url) {
    if (url.includes("://")) {
        return url;
    } else if (url.includes(':/')) {
        return url.replace(':/', '://');
    } else {
        return "http://" + url;
    }
}

/**
 * 获取环境变量中配置的域名白名单
 * 
 * @param {any} env 环境变量
 * @returns {Promise<string[]>} 返回白名单数组
 */
async function getWhiteHostArr(env) {
    const envWhiteArr = env.WHITE_HOST_LIST || ""
    return await ADD(envWhiteArr)
}

/**
 * 解析并清理环境变量中的地址列表
 * 这个函数用于处理包含多个地址的环境变量
 * 它会移除所有的空白字符、引号等，并将地址列表转换为数组
 * 
 * @param {string} envadd 包含地址列表的环境变量值
 * @returns {Promise<string[]>} 清理和分割后的地址数组
 */
async function ADD(envadd) {
	// 将制表符、双引号、单引号和换行符都替换为逗号
	// 然后将连续的多个逗号替换为单个逗号
	var addtext = envadd.replace(/[	|"'\r\n]+/g, ',').replace(/,+/g, ',');
	
	// 删除开头和结尾的逗号（如果有的话）
	if (addtext.charAt(0) == ',') addtext = addtext.slice(1);
	if (addtext.charAt(addtext.length - 1) == ',') addtext = addtext.slice(0, addtext.length - 1);
	
	// 使用逗号分割字符串，得到地址数组
	const result = addtext.split(',');
	
	return result;
}
