import { message, notification } from 'antd';

// 错误码映射
const ERROR_CODE_MAP = {
  200: '操作成功',
  400: '请求参数错误',
  401: '登录已过期，请重新登录',
  403: '无权限访问',
  404: '请求的资源不存在',
  409: '资源冲突',
  422: '请求数据格式错误',
  429: '请求过于频繁，请稍后再试',
  500: '服务器内部错误',
  502: '网关错误',
  503: '服务不可用',
  504: '网关超时',

  // 业务错误码
  1001: '用户不存在',
  1002: '用户已存在',
  1003: '密码错误',
  1004: '登录已过期，请重新登录',
  1005: '无效的登录凭证',
  1006: '权限不足',
  1007: '对话不存在',
  1008: '消息不存在',
  1009: 'AI服务暂时不可用',
  1010: '分享不存在',
  1011: '输入参数无效',
  1012: '操作过于频繁，请稍后再试',
  1013: '文件过大',
  1014: '不支持的文件类型',
};

// 默认错误信息
const DEFAULT_ERROR_MESSAGE = '操作失败，请稍后重试';

/**
 * 统一错误处理函数
 * @param {Error|Object} error - 错误对象
 * @param {Object} options - 配置选项
 * @param {boolean} options.silent - 静默模式，不显示提示
 * @param {string} options.type - 提示类型: 'message' | 'notification'
 * @param {number} options.duration - 持续时间（毫秒）
 */
export const handleError = (error, options = {}) => {
  const {
    silent = false,
    type = 'message',
    duration = 3,
  } = options;

  // 获取错误信息
  let errorCode = 500;
  let errorMessage = DEFAULT_ERROR_MESSAGE;

  // 从错误响应中获取错误码和信息
  if (error?.response?.data) {
    errorCode = error.response.data.code || 500;
    errorMessage = error.response.data.message || ERROR_CODE_MAP[errorCode] || DEFAULT_ERROR_MESSAGE;
  } else if (error?.code) {
    errorCode = error.code;
    errorMessage = ERROR_CODE_MAP[errorCode] || DEFAULT_ERROR_MESSAGE;
  } else if (error?.message) {
    errorMessage = error.message;
  }

  // 根据错误类型进行特殊处理
  handleSpecialError(error, errorCode);

  // 显示错误提示
  if (!silent) {
    if (type === 'notification') {
      notification.error({
        message: '错误',
        description: errorMessage,
        duration,
      });
    } else {
      message.error(errorMessage, duration);
    }
  }

  return {
    code: errorCode,
    message: errorMessage,
  };
};

/**
 * 特殊错误处理
 */
const handleSpecialError = (error, errorCode) => {
  // 401 错误特殊处理
  if (errorCode === 401 || errorCode === 1004 || errorCode === 1005) {
    // 如果已经有清除 token 的逻辑，就不重复处理
    if (!error._isTokenCleared) {
      error._isTokenCleared = true;
      // 清除本地 token
      localStorage.removeItem('token');
      // 触发登出事件
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  }
};

/**
 * 成功提示
 * @param {string} text - 提示文本
 * @param {Object} options - 配置选项
 */
export const showSuccess = (text, options = {}) => {
  const { type = 'message', duration = 2 } = options;

  if (type === 'notification') {
    notification.success({
      message: '成功',
      description: text,
      duration,
    });
  } else {
    message.success(text, duration);
  }
};

/**
 * 警告提示
 * @param {string} text - 警告文本
 * @param {Object} options - 配置选项
 */
export const showWarning = (text, options = {}) => {
  const { type = 'message', duration = 3 } = options;

  if (type === 'notification') {
    notification.warning({
      message: '警告',
      description: text,
      duration,
    });
  } else {
    message.warning(text, duration);
  }
};

/**
 * 信息提示
 * @param {string} text - 提示文本
 * @param {Object} options - 配置选项
 */
export const showInfo = (text, options = {}) => {
  const { type = 'message', duration = 3 } = options;

  if (type === 'notification') {
    notification.info({
      message: '提示',
      description: text,
      duration,
    });
  } else {
    message.info(text, duration);
  }
};

/**
 * 包装 API 请求，自动处理错误
 * @param {Promise} apiCall - API 调用
 * @param {Object} options - 错误处理选项
 */
export const withErrorHandling = async (apiCall, options = {}) => {
  try {
    const result = await apiCall;
    return result;
  } catch (error) {
    handleError(error, options);
    throw error; // 继续抛出错误，让调用者可以进一步处理
  }
};