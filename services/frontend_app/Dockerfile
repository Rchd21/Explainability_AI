FROM nginx:alpine

# Replace default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy service-specific nginx config
COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy static website files
COPY ./frontend /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
