import fetch, { Response as FetchResponse } from 'node-fetch';
import crypto from 'crypto';
import { JSDOM } from 'jsdom';
import { Agent as HttpsAgent } from 'https';

interface StreamResponse {
  data?: {
    rtmp_url?: string;
    rtmp_live?: string;
  };
  error?: number;
  msg?: string;
}

const agent = new HttpsAgent({
  family: 4,
  keepAlive: true,
  rejectUnauthorized: false
});

class DouYu {
  private did: string;
  private rid: string;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor(rid: string) {
    this.did = '10000000000000000000000000001501';
    this.rid = rid;
  }

  private md5(data: string): string {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  private async fetchWithRetry(url: string, options: any, retries = this.maxRetries): Promise<FetchResponse> {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response;
    } catch (error) {
      if (retries > 0) {
        console.log(`重试获取直播流 (剩余重试次数: ${retries - 1})`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  }

  private async getPcJs(cdn: string = 'tct', rate: number = 0): Promise<string> {
    try {
      const response = await this.fetchWithRetry(`https://www.douyu.com/${this.rid}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        agent: agent
      });

      const text = await response.text();

      // 检查页面是否包含错误信息
      if (text.includes('房间未找到') || text.includes('房间已关闭')) {
        console.log('房间未开播或不存在');
        return '';
      }

      // 提取JS函数
      const funcReg = /(vdwdae325w_64we[\s\S]*function ub98484234[\s\S]*?)function/;
      const funcMatch = text.match(funcReg);
      if (!funcMatch) {
        console.log('无法找到必要的JS函数');
        return '';
      }

      const evalReg = /eval\(.*?\);/g;
      const funcUb9 = funcMatch[1].replace(evalReg, 'strc;');

      // 创建虚拟DOM环境
      const dom = new JSDOM('', { runScripts: 'dangerously' });
      const window = dom.window;
      
      window.eval(funcUb9);
      const result = window.eval('ub98484234()') as string;

      const vReg = /v=(\d+)/;
      const vMatch = result.match(vReg);
      if (!vMatch) throw new Error('v parameter not found');

      const v = vMatch[1];
      const t10 = Math.floor(Date.now() / 1000).toString();

      const rb = this.md5(`${this.rid}${this.did}${t10}${v}`);

      let funcSign = result
        .replace('return rt;})', 'return rt;}')
        .replace('(function (', 'function sign(')
        .replace('CryptoJS.MD5(cb).toString()', `"${rb}"`);

      window.eval(funcSign);
      const params = window.eval(`sign("${this.rid}", "${this.did}", "${t10}");`) as string;

      const finalParams = `${params}&cdn=${cdn}&rate=${rate}`;

      // 获取真实URL
      const apiResponse = await this.fetchWithRetry(`https://www.douyu.com/lapi/live/getH5Play/${this.rid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://www.douyu.com',
          'Referer': `https://www.douyu.com/${this.rid}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: finalParams,
        agent: agent
      });

      const json = await apiResponse.json() as StreamResponse;

      if (json.error && json.error !== 0) {
        console.log('获取直播流失败:', json.msg);
        return '';
      }

      if (!json.data) {
        console.log('响应中缺少数据字段');
        return '';
      }

      const { rtmp_url, rtmp_live } = json.data;
      if (!rtmp_url || !rtmp_live) {
        console.log('缺少流地址组件');
        return '';
      }

      // 尝试不同的 CDN
      const cdns = ['tct', 'ws-h5', 'tx-h5'];
      if (!cdns.includes(cdn)) {
        return this.getPcJs(cdns[0], rate);
      }

      return `${rtmp_url}/${rtmp_live}`;

    } catch (error) {
      console.log('获取直播流出错:', error);
      return '';
    }
  }

  public async getStreamUrl(): Promise<string> {
    try {
      const url = await this.getPcJs();
      if (!url) {
        console.log('房间未开播或获取流地址失败');
        return '';
      }
      return url;
    } catch (error) {
      console.log('获取直播流失败:', error);
      return '';
    }
  }
}

export async function getStreamUrl(roomId: string): Promise<string> {
  const douyu = new DouYu(roomId);
  return await douyu.getStreamUrl();
}

export default DouYu; 