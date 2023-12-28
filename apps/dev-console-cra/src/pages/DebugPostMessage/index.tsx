import React, { useEffect } from 'react';
import { Button, Grid } from 'antd-mobile';
import { DemoBlock } from '../../components/DemoBlock';
import { webviewInPagePostMessage } from '@rabby-wallet/rn-webview-bridge';

import styles from './index.module.less';

export default function DebugPostMessage() {
  useEffect(() => {
    const listener = (event: MessageEvent<any>) => {
      // console.log('DebugPostMessage::event', event);
      console.log('DebugPostMessage::event.origin', event.origin);
      console.log('DebugPostMessage::event.data', event.data);
      // console.log('DebugPostMessage::event.source', event.source);
      if (event.ports.length) {
        console.log('DebugPostMessage::event.ports', event.ports);
      }
    };
    window.addEventListener('message', listener);

    return () => {
      window.removeEventListener('message', listener);
    };
  }, []);

  return (
    <>
      <DemoBlock title="Test Post Message">
        <Grid columns={3} gap={8}>
          <Grid.Item>
            <div>
              <Button
                size="small"
                color="primary"
                onClick={() => {
                  webviewInPagePostMessage();
                }}
              >
                Send Hello
              </Button>
            </div>
          </Grid.Item>
          <Grid.Item></Grid.Item>
          <Grid.Item></Grid.Item>
        </Grid>
      </DemoBlock>
    </>
  );
}
