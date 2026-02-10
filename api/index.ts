/**
 * Vercel Serverless Function 진입점
 *
 * 모든 /api/* 요청을 Express 앱으로 라우팅합니다.
 * Vercel은 이 파일을 자동으로 serverless function으로 변환합니다.
 */
import "dotenv/config";
import { createApp } from "../server/_core/index";

const app = createApp();

export default app;
