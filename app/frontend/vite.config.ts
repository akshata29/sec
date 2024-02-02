import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import Markdown from '@pity/vite-plugin-react-markdown'
import EnvironmentPlugin from 'vite-plugin-environment'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), 
        EnvironmentPlugin('all'),
        Markdown({
        wrapperComponentName: 'ReactMarkdown',
       // wrapperComponentPath: './src/pages/help/help',
      })],
    build: {
        outDir: "../backend/static",
        emptyOutDir: true,
        sourcemap: true
    },
    server: {
        port: 5174,
        proxy: {
            "/getSec": "http://127.0.0.1:5004",
            "/secChat": "http://127.0.0.1:5004",
            "/deleteIndexSession": "http://127.0.0.1:5004",
            "/getAllDocumentRuns": "http://127.0.0.1:5004",
            "/getAllIndexSessions": "http://127.0.0.1:5004",
            "/getAllSessions": "http://127.0.0.1:5004",
            "/getCashFlow": "http://127.0.0.1:5004",
            "/getIncomeStatement": "http://127.0.0.1:5004",
            "/getIndexSession": "http://127.0.0.1:5004",
            "/getIndexSessionDetail": "http://127.0.0.1:5004",
            "/getSocialSentiment": "http://127.0.0.1:5004",
            "/getNews": "http://127.0.0.1:5004",
            "/renameIndexSession": "http://127.0.0.1:5004",
            "/getSecFilingProcessedData": "http://127.0.0.1:5004",
            "/getSecFilingVectoredData": "http://127.0.0.1:5004",
            "/verifyPassword": "http://127.0.0.1:5004",
            "/uploadBinaryFile": "http://127.0.0.1:5004",
        }
        // proxy: {
        //     "/ask": {
        //          target: 'http://127.0.0.1:5000',
        //          changeOrigin: true,
        //          secure: false,
        //      }
        // }
    }
});
