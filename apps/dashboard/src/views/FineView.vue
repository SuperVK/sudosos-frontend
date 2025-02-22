<template>
  <div class="page-container">
    <div class="page-title">{{ t('fine.fineOverview') }}</div>
    <div class="content-wrapper flex flex-column gap-5">
      <CardComponent :header="t('fine.eligibleUsers')" class="w-full">
        <DataTable
          paginator
          :rows="10"
          :rowsPerPageOptions="[5, 10, 25, 50, 100]"
          :value="eligibleUsers"
          dataKey="id"
          v-model:selection="selection"
        >
          <template #header>
            <div class="flex flex-column">
              <div class="flex flex-row justify-content-between">
                <form @submit.prevent="handlePickedDates" class="flex flex-row gap-3">
                  <span class="p-float-label">
                    <Calendar
                      v-model="firstDate"
                      id="firstDate"
                      v-bind="firstDateAttrs"
                      showTime
                      hourFormat="24"
                    />
                    <label for="firstDate">{{ t('fine.firstDate') }}</label>
                  </span>
                  <span class="p-float-label">
                    <Calendar
                      v-model="secondDate"
                      id="firstDate"
                      v-bind="secondDateAttrs"
                      showTime
                      hourFormat="24"
                    />
                    <label for="secondDate">{{ t('fine.secondDate') }}</label>
                  </span>
                  <Button type="submit">{{ t('fine.apply') }}</Button>
                  <Button @click="notifyUsers" severity="info">{{ t('fine.notify') }}</Button>
                  <ProgressSpinner class="h-2rem ml-0" v-if="isNotifying"/>
                </form>
                <Button @click="handoutFines">{{ t('fine.handout') }}</Button>
              </div>
              <p class="text-red-500">
                {{
                  showMessage ? t('fine.infoMessage', {
                    fines: formatPrice(totalFines),
                    debt: formatPrice(totalDebt)
                  }): t('fine.pleaseSelect')
                }}
              </p>
            </div>
          </template>
          <Column selectionMode="multiple" />
          <Column field="gewisId" :header="t('fine.gewisId')" />
          <Column field="fullName" :header="t('fine.name')" />
          <Column field="firstBalance" :header="t('fine.firstBalance')">
            <template #body="slotProps">
              {{ formatPrice(slotProps.data.firstBalance.amount) }}
            </template>
          </Column>
          <Column field="lastBalance" :header="t('fine.lastBalance')">
            <template #body="slotProps">
              {{ formatPrice(slotProps.data.lastBalance.amount) }}
            </template>
          </Column>
        </DataTable>
      </CardComponent>
      <CardComponent :header="t('fine.fineHandoutEvents')" class="w-full">
        <DataTable
          paginator
          :rows="10"
          :rowsPerPageOptions="[5, 10, 25, 50, 100]"
          :value="fineHandoutEvents"
          @row-click="(e: any) => openHandoutEvent(e.data.id)"
        >
          <Column field="id" id="id" :header="t('fine.id')">
            <template #body v-if="isLoading">
              <Skeleton class="w-4 my-1 h-1rem surface-300"/>
            </template>
          </Column>
          <Column field="createdAt" id="date" :header="t('fine.date')">
            <template #body v-if="isLoading">
              <Skeleton class="w-7 my-1 h-1rem surface-300"/>
            </template>
            <template #body="slotProps" v-else>{{ formatDateTime(new Date(slotProps.data.createdAt)) }}</template>
          </Column>
          <Column field="referenceDate" id="referenceDate" :header="t('fine.referenceDate')">
            <template #body v-if="isLoading">
              <Skeleton class="w-4 my-1 h-1rem surface-300"/>
            </template>
            <template #body="slotProps" v-else>{{ formatDateTime(new Date(slotProps.data.referenceDate)) }}</template>
          </Column>
          <Column id="info" :header="t('fine.info')" >
            <template #body v-if="isLoading">
              <Skeleton class="w-2 my-1 h-1rem surface-300"/>
            </template>
            <template #body v-else>
              <i class="pi pi-info-circle"/>
            </template>
          </Column>
        </DataTable>
      </CardComponent>
    </div>
  </div>
    <Dialog v-model:visible="showModal" class="w-auto flex w-9 md:w-4" :header="t('fine.handoutEventDetails')">
      <div class="flex flex-column">
        <div class="flex flex-row justify-content-between">
          <p>{{ t("fine.fineNumber") }}</p>
          <p>{{ selectedHandoutEvent?.fines.length }}</p>
        </div>
        <div class="flex flex-row justify-content-between">
          <p>{{ t("fine.fineTotal") }}</p>
          <p>{{ formatPrice(modalTotalFines) }}
          </p>
        </div>
        <div class="flex flex-row justify-content-between">
          <p>{{ t("fine.createdAt") }}</p>
          <p>{{ formatDateTime(new Date(selectedHandoutEvent?.createdAt || '')) }}</p>
        </div>
        <div class="flex flex-row justify-content-between">
          <p>{{ t("fine.referenceDate") }}</p>
          <p>{{ formatDateTime(new Date(selectedHandoutEvent?.referenceDate || '')) }}</p>
        </div>
      </div>
    </Dialog>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import DataTable from 'primevue/datatable';
import Column from "primevue/column";
import CardComponent from "@/components/CardComponent.vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import Calendar from "primevue/calendar";
import apiService from "@/services/ApiService";
import { onMounted, type Ref, ref } from "vue";
import { useUserStore } from "@sudosos/sudosos-frontend-common";
import { formatDateTime, formatPrice } from "@/utils/formatterUtils";
import { useRouter } from "vue-router";
import { type DineroObject } from 'dinero.js';
import { floor, min } from "lodash";
import type { FineHandoutEventResponse, UserResponse } from "@sudosos/sudosos-client";
import { fetchAllPages } from "@sudosos/sudosos-frontend-common";
import { useToast } from "primevue/usetoast";
import type { AxiosError } from "axios";
import { handleError } from "@/utils/errorUtils";
import Skeleton from "primevue/skeleton";
import ProgressSpinner from "primevue/progressspinner";

const { t } = useI18n();
const router = useRouter();
const eligibleUsers = ref();
const userStore = useUserStore();
const { defineField, handleSubmit } = useForm({
  validationSchema: toTypedSchema(
    yup.object({
      firstDate: yup.date().required(),
      secondDate: yup.date().required(),
    }
  ))
});
const toast = useToast();
const selection = ref();
const isNotifying: Ref<boolean> = ref(false);
const [firstDate, firstDateAttrs] = defineField('firstDate');
const [secondDate, secondDateAttrs] = defineField('secondDate');
const showModal: Ref<boolean> = ref(false);
const selectedHandoutEvent: Ref<FineHandoutEventResponse | undefined> = ref();
const isLoading: Ref<boolean> = ref(true);
const totalFines: Ref<DineroObject> = ref({
  amount: 0,
  currency: 'EUR',
  precision: 2
});
const totalDebt: Ref<DineroObject> = ref({
  amount: 0,
  currency: 'EUR',
  precision: 2
});
const modalTotalFines: Ref<DineroObject> = ref({
  amount: 0,
  currency: 'EUR',
  precision: 2
});
const showMessage: Ref<boolean>  = ref(false);
const fineHandoutEvents: Ref<Array<FineHandoutEventResponse>> = ref(new Array(10));
const handlePickedDates = handleSubmit(async (values) => {
  const result = await apiService.debtor.calculateFines(
    [values.firstDate.toISOString(), values.secondDate.toISOString()],
    [1]);
  const userFullNameMap: { [key: number]: string } = {};
  userStore.users.forEach((user: any) => {
    userFullNameMap[user.id] = `${user.firstName} ${user.lastName}`;
  });
  const deletedUsers = userStore.getDeletedUsers.map((u: UserResponse) => u.id);
  const activeUsers = userStore.getActiveUsers.map((u: UserResponse) => u.id);
  eligibleUsers.value = result.data.map((item: any) => {

    const fullName = userFullNameMap[item.id];

    // Extract balances from the item
    const [firstBalance, secondBalance] = item.balances || [null, null];

    return {
      ...item,
      // @ts-ignore
      gewisId: (userStore.users.find((u: UserResponse) => u.id === item.id) as UserResponse).gewisId || undefined,
      fullName,
      // Assign first and last balance based on the first and second items in the balances array
      firstBalance,
      lastBalance: secondBalance,
    };
  }).filter((u: any) => !deletedUsers.includes(u.id) && activeUsers.includes(u.id));
  const totalDebtAmount = eligibleUsers.value.reduce((accumulator: number, current: any) => {
    return accumulator + current.firstBalance.amount.amount; // Use getAmount() to access the value
  }, 0);
  const totalFinesAmount = eligibleUsers.value.reduce((accumulator: number, current: any) => {
    return accumulator + (min([floor(current.firstBalance.amount.amount / -500) * 100, 500]) || 0);
  }, 0);
  totalDebt.value = {
    amount: totalDebtAmount,
    currency: 'EUR',
    precision: 2,
  };
  totalFines.value = {
    amount: totalFinesAmount,
    currency: 'EUR',
    precision: 2,
  };
  showMessage.value = true;
});

onMounted(async () => {
  await userStore.fetchUsers(apiService);
  fineHandoutEvents.value = await fetchAllPages<FineHandoutEventResponse>(
    0,
    Number.MAX_SAFE_INTEGER,
    // @ts-ignore
    (take, skip) => apiService.debtor.returnAllFineHandoutEvents(take, skip)
  );
  isLoading.value = false;
});
const openHandoutEvent = async (eventId: number) => {
  selectedHandoutEvent.value = await apiService.debtor.returnSingleFineHandoutEvent(eventId).then((res) => {
    return res.data;
  });
  if(!selectedHandoutEvent.value){
    await router.replace('/error');
    return;
  }
  showModal.value = true;
  const totalOfFines = selectedHandoutEvent.value.fines.reduce((accumulator: number, current: any) => {
    return accumulator + (current.amount.amount|| 0);
  }, 0);
  modalTotalFines.value = {
    amount: totalOfFines,
    currency: 'EUR',
    precision: 2,
  };
};

const notifyUsers = async () => {
  isNotifying.value = true;
  apiService.debtor.notifyAboutFutureFines({
    userIds: selection.value.map((item: any) => item.id),
    referenceDate: secondDate.value?.toISOString() || new Date().toISOString()
  })
    .then(() => {
      toast.add({
        summary: t('successMessages.success'),
        detail: t('successMessages.finesNotified'),
        life: 3000,
        severity: 'success',
      });
      isNotifying.value = false;
      selection.value = [];
    });
};

const handoutFines = async () => {
  if (!firstDate.value) {
    await router.replace({ path: "/error" });
    return;
  }
  await apiService.debtor.handoutFines({
    userIds: selection.value.map((item: any) => item.id),
    referenceDate: firstDate.value.toISOString(),
  })
    .then(() => {
      toast.add({
        summary: t('successMessages.success'),
        detail: t('successMessages.finesHandedOut'),
        life: 3000,
        severity: 'success',
      });
    })
    .catch((err: AxiosError) => handleError(err, toast))
    .finally(() => selection.value = []);
};
</script>

<style scoped>
@import '../styles/BasePage.scss';
</style>
