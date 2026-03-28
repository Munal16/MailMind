from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


class MailMindTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        identifier = str(attrs.get(self.username_field, "")).strip()

        if identifier:
            user = (
                User.objects.filter(
                    Q(username__iexact=identifier) | Q(email__iexact=identifier)
                )
                .order_by("id")
                .first()
            )
            if user:
                attrs[self.username_field] = user.username

        return super().validate(attrs)


class MailMindTokenObtainPairView(TokenObtainPairView):
    serializer_class = MailMindTokenObtainPairSerializer
