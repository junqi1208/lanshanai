import React, { useState } from 'react';
import { Card, Button, Input, message } from 'antd';
import { withErrorHandling, useApi } from '@/components/WithErrorHandling';
import { ask } from '@/api/ai';
import { handleError, showSuccess, showWarning } from '@/utils/errorHandler';

// 示例组件：使用 HOC 进行错误处理
const ChatForm = withErrorHandling(({ withLoading }) => {
  const [prompt, setPrompt] = useState('');

  const handleSend = async () => {
    if (!prompt.trim()) {
      showWarning('请输入提问内容');
      return;
    }

    try {
      const result = await withLoading(ask, { prompt });
      showSuccess('提问成功');
      console.log('AI 回答:', result);
    } catch (error) {
      // 错误已经在 HOC 中处理
      console.error('提问失败:', error);
    }
  };

  return (
    <Card title="AI 对话" style={{ marginBottom: 16 }}>
      <Input
        placeholder="请输入你的问题..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onPressEnter={handleSend}
      />
      <Button
        type="primary"
        onClick={handleSend}
        style={{ marginTop: 16 }}
      >
        发送
      </Button>
    </Card>
  );
});

// 示例组件：使用 Hook 进行错误处理
const UserProfile = () => {
  const [username, setUsername] = useState('');
  const { data: user, loading, execute: updateUser } = useApi(
    async (newUsername) => {
      // 这里应该是更新用户信息的 API
      // return await updateMe({ nickname: newUsername });
      return { username: newUsername };
    },
    { showError: true }
  );

  const handleUpdate = async () => {
    if (!username.trim()) {
      showWarning('请输入用户名');
      return;
    }

    try {
      await updateUser(username);
      message.success('用户名更新成功');
    } catch (error) {
      // 错误已经在 hook 中处理
      console.error('更新失败:', error);
    }
  };

  return (
    <Card title="用户资料">
      <Input
        placeholder="输入新的用户名"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <Button
        type="primary"
        onClick={handleUpdate}
        loading={loading}
        style={{ marginTop: 16 }}
      >
        更新
      </Button>
    </Card>
  );
};

// 示例组件：手动错误处理
const ManualErrorHandling = () => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = async () => {
    if (!inputValue.trim()) {
      showWarning('请输入内容');
      return;
    }

    try {
      // 模拟 API 调用
      // const result = await someApiCall(inputValue);

      // 使用自定义错误处理
      handleError(new Error('这是一个模拟错误'), {
        type: 'notification',
        duration: 5,
      });

    } catch (error) {
      // 也可以手动处理错误
      handleError(error, {
        silent: true, // 静默模式，不显示提示
      });
    }
  };

  return (
    <Card title="手动错误处理示例">
      <Input
        placeholder="输入任意内容触发错误"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
      <Button
        type="dashed"
        onClick={handleSubmit}
        style={{ marginTop: 16 }}
      >
        触发错误处理
      </Button>
    </Card>
  );
};

export default function ErrorHandlingDemo() {
  return (
    <div style={{ padding: 24 }}>
      <h1>错误处理示例</h1>
      <ChatForm />
      <UserProfile />
      <ManualErrorHandling />

      <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
        <h3>使用说明：</h3>
        <ul>
          <li><strong>ChatForm</strong>: 使用 withErrorHandling HOC 自动处理错误</li>
          <li><strong>UserProfile</strong>: 使用 useApi hook 管理 API 状态</li>
          <li><strong>ManualErrorHandling</strong>: 展示手动错误处理方式</li>
        </ul>
      </div>
    </div>
  );
}