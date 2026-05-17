FROM nginx:alpine

# nginx:alpine procesa los archivos de /templates con envsubst al arrancar:
# sustituye ${PORT} (que asigna Render) y escribe el resultado en conf.d.
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY index.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

# Puerto por defecto para desarrollo local; Render lo sobrescribe con el suyo.
ENV PORT=80

# Solo sustituye ${PORT}; deja intactas las variables internas de nginx.
ENV NGINX_ENVSUBST_FILTER=^PORT$

EXPOSE 80
