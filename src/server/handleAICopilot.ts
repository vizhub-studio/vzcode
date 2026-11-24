import { ChatOpenAI } from '@langchain/openai';
import { StringOutputParser } from '@langchain/core/output_parsers';

// This module implements the generation of the copilot response.

// Debug flag to log more information during development.
const debug = false;

export const handleAICopilot = () => {
  // These environment variables are used to configure the OpenAI client.
  // See `.env.sample` for the expected values.
  const {
    VZCODE_AI_COPILOT_API_KEY,
    VZCODE_AI_COPILOT_BASE_URL,
    VZCODE_AI_COPILOT_MODEL,
  } = process.env;

  // If neither of these are not set, the OpenAI client will not be initialized,
  // e.g. for local development where no AI is needed.
  const isCopilotEnabled =
    VZCODE_AI_COPILOT_API_KEY !== undefined &&
    VZCODE_AI_COPILOT_BASE_URL !== undefined &&
    VZCODE_AI_COPILOT_MODEL !== undefined;

  debug &&
    console.log('isCopilotEnabled: ' + isCopilotEnabled);

  debug &&
    console.log({
      VZCODE_AI_COPILOT_API_KEY,
      VZCODE_AI_COPILOT_BASE_URL,
      VZCODE_AI_COPILOT_MODEL,
    });

  let chatModel;
  if (isCopilotEnabled) {
    const options = {
      modelName: VZCODE_AI_COPILOT_MODEL,
      configuration: {
        apiKey: VZCODE_AI_COPILOT_API_KEY,
        baseURL: VZCODE_AI_COPILOT_BASE_URL,
      },
      additionalParameters: {
        provider: { sort: 'throughput' },
      },
      streaming: false,
    };
    debug && console.log('chatModel options:', options);
    chatModel = new ChatOpenAI(options);
  }

  return async (req, res) => {
    // Don't break if the AI is not enabled.
    // This is useful for local development.
    if (!isCopilotEnabled) {
      res.status(200).send({ text: '' });
      return;
    }
    const { prefix, suffix } = req.body;

    const messages = [
      {
        role: 'user',
        content: [
          'Complete the missing part of the text below:\n\n',
          '\`\`\`\n',
          prefix,
          '<MISSING_PART>',
          suffix,
          '\`\`\`\n\n',
          'ONLY output the text that replaces <MISSING_PART>.\n\n',
          'NEVER include \`\`\`javascript or similar code blocks.\n\n',
        ].join(''),
      },
    ];
    if (debug) {
      console.log(
        '[generateAIResponse] prompt:\n```\n' +
          messages[0].content +
          '\n```\n',
      );
    }
    try {
      const result = await chatModel.invoke(messages);
      const parser = new StringOutputParser();
      const text = await parser.invoke(result);

      res.status(200).send({ text });
    } catch (error) {
      console.error('handleAICopilot error:', error);
      const message =
        error instanceof Error
          ? error.message
          : String(error);
      res.status(500).send({
        message: 'Internal Server Error',
        error: message,
      });
    }
  };
};
