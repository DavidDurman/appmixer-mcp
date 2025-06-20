import { EventSource } from 'eventsource';

const APPMIXER_BASE_URL = process.env.APPMIXER_BASE_URL;
const APPMIXER_ACCESS_TOKEN = process.env.APPMIXER_ACCESS_TOKEN;
const APPMIXER_USERNAME = process.env.APPMIXER_USERNAME;
const APPMIXER_PASSWORD = process.env.APPMIXER_PASSWORD;

function isTokenExpired(token) {
    try {
        // Just decode the payload part (no secret needed)
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        return payload.exp < currentTime;
    } catch (error) {
        return true;
    }
}

export class AppmixerClient {
  constructor() {
    this.name = 'Appmixer';
    this.version = '1.0.0';
    this.accessToken = APPMIXER_ACCESS_TOKEN;
  }

  async request(url, method = 'GET', body) {
      if (!this.accessToken || isTokenExpired(this.accessToken)) {
        this.accessToken = await this.refreshToken();
      }
      const req = {
        method,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      };
      if (body) {
        req.body = JSON.stringify(body);
      }
      const response = await fetch(url, req);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
      }
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (err) {
        return text;
      }
  }

  async refreshToken() {
    try {
      const response = await fetch(`${APPMIXER_BASE_URL}/user/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: APPMIXER_USERNAME,
          password: APPMIXER_PASSWORD
        })
      });
      if (!response.ok) {
        throw new Error(`Failed to refresh token: ${response.statusText}`);
      }
      const data = await response.json();
      return data.token;
    } catch (e) {
      console.error('Error refreshing token:', e);
    }
  }
  
  async getFlows() {
    try {
      return this.request(`${APPMIXER_BASE_URL}/flows`);
    } catch (e) {
      console.error(e);
    }
  }
  
  async getFlow(id) {
    try {
      return this.request(`${APPMIXER_BASE_URL}/flows/${id}`);
    } catch (e) {
      console.error(e);
    }
  }

  async deleteFlow(id) {
    try {
      return this.request(`${APPMIXER_BASE_URL}/flows/${id}`, 'DELETE');
    } catch (e) {
      console.error(e);
    }
  }

  async startFlow(id) {
    try {
      return this.request(`${APPMIXER_BASE_URL}/flows/${id}/coordinator`, 'POST', {
        command: 'start'
      });
    } catch (e) {
      console.error(e);
    }
  }

  async stopFlow(id) {
    try {
      return this.request(`${APPMIXER_BASE_URL}/flows/${id}/coordinator`, 'POST', {
        command: 'stop'
      });
    } catch (e) {
      console.error(e);
    }
  }

  async triggerComponent(flowId, componentId, method = 'POST', body = '') {
    try {
      const requestBody = body ? JSON.parse(body) : {};
      return this.request(`${APPMIXER_BASE_URL}/flows/${flowId}/components/${componentId}`, method, requestBody);
    } catch (e) {
      console.error(e);
    }
  }

  async getLogs(flowId, query) {
    try {
      let queryString = 'flowId=' + flowId;
      if (query) {
        queryString += `&query=${encodeURIComponent(query)}`;
      }
      return this.request(`${APPMIXER_BASE_URL}/logs?${queryString}`);
    } catch (e) {
      console.error(e);
    }
  }

  async getGateways() {
    try {
      return this.request(`${APPMIXER_BASE_URL}/plugins/appmixer/ai/mcptools/gateways`);
    } catch (e) {
      console.error(e);
    }
  }

  async connectEventSource(onMessage) {
    if (!this.accessToken || isTokenExpired(this.accessToken)) {
        this.accessToken = await this.refreshToken();
    }
    const url = `${APPMIXER_BASE_URL}/plugins/appmixer/ai/mcptools/events?token=${this.accessToken}`;
    const eventSource = new EventSource(url);

    eventSource.addEventListener('error', (err) => {
      console.error('EventSource error:', err);
      eventSource.close();
      setTimeout(() => {
        this.connectEventSource(onMessage); // Reconnect on error
      }, 5000); // Retry after 5 seconds
    });

    eventSource.addEventListener('open', () => {
    });

    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
        // Handle the event data as needed
      } catch (err) {
        console.error('Error parsing event data:', err);
      }
    });
  }
}
