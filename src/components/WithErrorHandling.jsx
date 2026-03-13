import React, { useState } from 'react';
import { Spin } from 'antd';

/**
 * 错误处理 HOC
 * @param {React.Component} WrappedComponent - 需要包装的组件
 * @param {Object} options - 配置选项
 * @param {Function} options.errorHandler - 自定义错误处理函数
 * @param {boolean} options.showError - 是否自动显示错误
 */
export const withErrorHandling = (WrappedComponent, options = {}) => {
  const { errorHandler: customErrorHandler, showError = true } = options;

  const ErrorHandlingWrapper = (props) => {
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleError = (err) => {
      setError(err);
      if (showError && !customErrorHandler) {
        // 使用默认错误处理
        const { handleError } = require('@/utils/errorHandler');
        handleError(err);
      } else if (customErrorHandler) {
        customErrorHandler(err);
      }
    };

    const withLoading = async (asyncFn, ...args) => {
      setLoading(true);
      try {
        return await asyncFn(...args);
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    };

    // 增强组件的 props
    const enhancedProps = {
      ...props,
      error,
      loading,
      handleError,
      withLoading,
    };

    if (loading && !props.loading) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      );
    }

    if (error && !props.children) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#ff4d4f' }}>
          <p>操作失败，请稍后重试</p>
        </div>
      );
    }

    return <WrappedComponent {...enhancedProps} />;
  };

  // 保留原始组件的名称
  const wrappedName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
  ErrorHandlingWrapper.displayName = `WithErrorHandling(${wrappedName})`;

  return ErrorHandlingWrapper;
};

/**
 * API 请求 Hook
 * @param {Function} apiFn - API 函数
 * @param {Object} options - 配置选项
 */
export const useApi = (apiFn, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = async (...args) => {
    setLoading(true);
    try {
      const result = await apiFn(...args);
      setData(result);
      setError(null);
      return result;
    } catch (err) {
      setError(err);
      if (options.showError !== false) {
        const { handleError } = require('@/utils/errorHandler');
        handleError(err);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    loading,
    error,
    execute,
    reset: () => {
      setData(null);
      setError(null);
      setLoading(false);
    },
  };
};